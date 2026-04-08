import type { ApiProvider } from "../types/config.js";
import type {
  ActualRelease,
  ExpectedRelease,
  ExecutionPathModel,
  FunctionResourceModel,
  ModelerResult,
  ModeledFunction,
  ResourceLifecycle,
  ResourceType
} from "../types/model.js";
import type { ScannedCall, ScannedFunction } from "../types/scan.js";
import { estimateCost } from "../utils/cost.js";
import { sha256 } from "../utils/hash.js";
import type { Logger } from "../utils/logger.js";
import { redactSecrets } from "../utils/redaction.js";
import { buildCacheKey, getCache, setCache } from "./cache.js";
import { createLlmClient, type LlmClient } from "./llm-client.js";
import {
  buildAnalyzeBatchPrompt,
  buildAnalyzePrompt,
  loadAnalyzePromptAssets,
  loadBatchPromptAssets
} from "./prompt-builder.js";
import { parseBatchModelResponse } from "./response-parser.js";

const MODELER_VERSION = "0.2.0";
const REDACTION_POLICY_VERSION = "2";
const MAX_BATCH_FUNCTIONS = 5;
const MAX_BATCH_TOKENS = 32000;

export interface ModelerOptions {
  provider: ApiProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string | null;
  noCache: boolean;
  redactSecrets: boolean;
  parallel: number;
  costLimit?: number;
  logger: Logger;
  enableLlm?: boolean;
}

interface PreparedFunction {
  fn: ScannedFunction;
  deterministicModel: FunctionResourceModel;
  cacheKey: string;
  promptTokenEstimate: number;
}

interface BatchTask {
  items: PreparedFunction[];
  promptPayload: string;
  estimatedCost: number;
}

function estimateTokensFromChars(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function redactionPolicyVersion(redactSecretsEnabled: boolean): string {
  return `${REDACTION_POLICY_VERSION}:${redactSecretsEnabled ? "redacted" : "raw"}`;
}

function inferResourceType(callName: string): ResourceType {
  if (/\b(begin|commit|rollback)\b/i.test(callName)) {
    return "transaction";
  }
  if (/\b(open|create|tempfile|filestream|reader|writer)\b/i.test(callName)) {
    return "file_handle";
  }
  if (/\b(lock|mutex|rlock|acquire)\b/i.test(callName)) {
    return "lock";
  }
  if (/\b(connect|dial|socket|session|client|pool|getconnection)\b/i.test(callName)) {
    return "connection";
  }
  if (/\b(malloc|calloc|realloc|new)\b/i.test(callName)) {
    return "memory";
  }
  if (/\b(withcancel|withtimeout|withdeadline)\b/i.test(callName)) {
    return "context";
  }
  if (/\bchan(nel)?\b/i.test(callName)) {
    return "channel";
  }
  return "custom";
}

function expectedReleaseForType(type: ResourceType, variable: string): ExpectedRelease[] {
  switch (type) {
    case "transaction":
      return [
        {
          expression: `${variable}.Rollback()`,
          type: "error",
          description: "Rollback must run on error paths"
        },
        {
          expression: `${variable}.Commit()`,
          type: "normal",
          description: "Commit must run on successful completion"
        }
      ];
    case "file_handle":
    case "connection":
      return [{ expression: `${variable}.Close()`, type: "cleanup", description: "Close must run before all exits" }];
    case "lock":
      return [{ expression: `${variable}.Unlock()`, type: "cleanup", description: "Unlock must run before all exits" }];
    case "memory":
      return [{ expression: `free(${variable})`, type: "cleanup", description: "Memory must be released on every path" }];
    case "context":
      return [{ expression: "cancel()", type: "cleanup", description: "Cancellation function must be called" }];
    case "channel":
      return [{ expression: `close(${variable})`, type: "cleanup", description: "Channel should be closed on completion" }];
    default:
      return [{ expression: `${variable}.close()`, type: "cleanup", description: "Resource should be released on all paths" }];
  }
}

function callMatchesResource(call: ScannedCall, variable: string, type: ResourceType): boolean {
  const lowerName = call.name.toLowerCase();
  const normalizedVariable = variable.toLowerCase();
  const normalizedCallVariable = call.variable?.toLowerCase();

  if (type === "memory") {
    return /\bfree\b/.test(lowerName) && normalizedCallVariable === normalizedVariable;
  }
  if (type === "context") {
    return /\bcancel\b/.test(lowerName);
  }
  if (type === "channel") {
    return /\bclose\b/.test(lowerName) && normalizedCallVariable === normalizedVariable;
  }

  return normalizedCallVariable === normalizedVariable;
}

function lineAt(fn: ScannedFunction, line: number): string {
  const index = line - fn.startLine;
  const lines = fn.source.split(/\r?\n/);
  return lines[index] ?? "";
}

function releaseMechanism(fn: ScannedFunction, releaseLine: number): ExecutionPathModel["releaseMechanism"] {
  const line = lineAt(fn, releaseLine);
  if (/\bdefer\b/.test(line)) {
    return "defer";
  }
  if (/\bfinally\b/.test(line)) {
    return "finally";
  }
  if (fn.language === "python" && /\bwith\b/.test(line)) {
    return "with_statement";
  }
  if (fn.language === "rust") {
    return "RAII";
  }
  return "direct_call";
}

function isAcquireFailurePath(fn: ScannedFunction, acquireLine: number, exitLine: number): boolean {
  if (exitLine < acquireLine || exitLine - acquireLine > 2) {
    return false;
  }

  const lines = fn.source.split(/\r?\n/);
  const start = Math.max(0, acquireLine - fn.startLine);
  const end = Math.min(lines.length - 1, exitLine - fn.startLine);

  for (let index = start; index <= end; index += 1) {
    if (/\bif\s+err\s*!=\s*nil\b/.test(lines[index])) {
      return true;
    }
  }

  return false;
}

function releaseCoversExit(fn: ScannedFunction, releaseLine: number, exitLine: number): boolean {
  const releaseContexts = fn.lineContexts[releaseLine] ?? [];
  const exitContexts = fn.lineContexts[exitLine] ?? [];
  const exitChoices = new Map(exitContexts.map((entry) => [entry.branchId, entry.choice]));

  for (const context of releaseContexts) {
    if (exitChoices.get(context.branchId) !== context.choice) {
      return false;
    }
  }

  return true;
}

function branchLinesForPath(fn: ScannedFunction, acquireLine: number, exitLine: number): number[] {
  const exitContexts = fn.lineContexts[exitLine] ?? [];
  const branchLines = new Set<number>();

  for (const context of exitContexts) {
    if (context.branchLine > acquireLine && context.branchLine <= exitLine) {
      branchLines.add(context.branchLine);
    }
  }

  return [...branchLines].sort((left, right) => left - right);
}

function summarize(resources: ResourceLifecycle[]): FunctionResourceModel["summary"] {
  const totalPaths = resources.reduce((sum, resource) => sum + resource.executionPaths.length, 0);
  const pathsWithMissingRelease = resources.reduce(
    (sum, resource) => sum + resource.executionPaths.filter((path) => !path.resourceReleased).length,
    0
  );

  let riskLevel: FunctionResourceModel["summary"]["riskLevel"] = "none";
  if (pathsWithMissingRelease === 1) {
    riskLevel = "low";
  } else if (pathsWithMissingRelease === 2) {
    riskLevel = "medium";
  } else if (pathsWithMissingRelease >= 3) {
    riskLevel = "high";
  }

  if (
    resources.some(
      (resource) => resource.type === "transaction" || resource.type === "lock" || resource.type === "memory"
    ) &&
    pathsWithMissingRelease > 0
  ) {
    riskLevel = "critical";
  }

  return {
    totalResources: resources.length,
    totalPaths,
    pathsWithMissingRelease,
    riskLevel
  };
}

function buildDeterministicModel(fn: ScannedFunction): FunctionResourceModel {
  const acquires = fn.calls.filter((call) => call.category === "resource_acquire");
  const releases = fn.calls.filter((call) => call.category === "resource_release");
  const resources: ResourceLifecycle[] = [];

  for (let index = 0; index < acquires.length; index += 1) {
    const acquire = acquires[index];
    const resourceType = inferResourceType(acquire.name);
    const variable = acquire.variable ?? `resource_${index + 1}`;

    const actualReleases: ActualRelease[] = releases
      .filter((release) => release.line > acquire.line)
      .filter((release) => callMatchesResource(release, variable, resourceType))
      .map((release) => ({
        expression: `${release.name}()`,
        line: release.line,
        onPath: `line ${release.line}`,
        coversErrorPaths: fn.exitPoints.some(
          (exit) => exit.inErrorHandler && release.line <= exit.line && releaseCoversExit(fn, release.line, exit.line)
        )
      }));

    if (fn.language === "python" && resourceType === "file_handle") {
      const acquireLineText = lineAt(fn, acquire.line);
      if (/^\s*with\b/.test(acquireLineText) && /\bopen\s*\(/.test(acquireLineText)) {
        actualReleases.push({
          expression: "context_manager.__exit__()",
          line: acquire.line,
          onPath: "context manager exit",
          coversErrorPaths: true
        });
      }
    }

    const executionPaths: ExecutionPathModel[] = [];
    for (let exitIndex = 0; exitIndex < fn.exitPoints.length; exitIndex += 1) {
      const exit = fn.exitPoints[exitIndex];
      if (exit.line < acquire.line) {
        continue;
      }

      const coveringRelease = [...actualReleases]
        .reverse()
        .find((release) => release.line <= exit.line && releaseCoversExit(fn, release.line, exit.line));
      const acquireFailurePath = isAcquireFailurePath(fn, acquire.line, exit.line) && exit.inErrorHandler;
      executionPaths.push({
        id: `path_${exitIndex + 1}`,
        description:
          exit.type === "fallthrough"
            ? `normal completion at line ${exit.line}`
            : `${exit.type} at line ${exit.line}${exit.inErrorHandler ? " (error path)" : ""}`,
        lines: [acquire.line, exit.line],
        branchLines: branchLinesForPath(fn, acquire.line, exit.line),
        exitType: exit.type,
        resourceReleased: Boolean(coveringRelease) || acquireFailurePath,
        releaseMechanism: coveringRelease ? releaseMechanism(fn, coveringRelease.line) : "none",
        notes: coveringRelease
          ? `Release found at line ${coveringRelease.line}`
          : acquireFailurePath
            ? "Acquire may have failed before resource became valid"
            : "No matching release before this exit"
      });
    }

    resources.push({
      id: `${resourceType}_${index + 1}`,
      type: resourceType,
      acquire: {
        expression: `${acquire.name}()`,
        line: acquire.line,
        variable
      },
      expectedReleases: expectedReleaseForType(resourceType, variable),
      actualReleases,
      executionPaths
    });
  }

  return {
    resources,
    summary: summarize(resources)
  };
}

function mergeModels(base: FunctionResourceModel, llm: FunctionResourceModel): FunctionResourceModel {
  const byKey = new Map<string, ResourceLifecycle>();

  for (const resource of base.resources) {
    const key = `${resource.type}:${resource.acquire.line}:${resource.acquire.variable}`;
    byKey.set(key, resource);
  }

  for (const resource of llm.resources) {
    const key = `${resource.type}:${resource.acquire.line}:${resource.acquire.variable}`;
    if (!byKey.has(key)) {
      byKey.set(key, resource);
      continue;
    }

    const existing = byKey.get(key) as ResourceLifecycle;
    if (resource.executionPaths.length > existing.executionPaths.length) {
      byKey.set(key, resource);
    }
  }

  const resources = [...byKey.values()];
  return {
    resources,
    summary: summarize(resources)
  };
}

function extractProviderApiKey(provider: ApiProvider, explicit?: string): string | undefined {
  if (explicit) {
    return explicit;
  }
  if (process.env.LEAKGUARD_API_KEY) {
    return process.env.LEAKGUARD_API_KEY;
  }
  if (provider === "anthropic") {
    return process.env.ANTHROPIC_API_KEY;
  }
  if (provider === "openai") {
    return process.env.OPENAI_API_KEY;
  }
  return undefined;
}

function createBatches(prepared: PreparedFunction[]): PreparedFunction[][] {
  const byFile = new Map<string, PreparedFunction[]>();
  for (const item of prepared) {
    const entries = byFile.get(item.fn.file) ?? [];
    entries.push(item);
    byFile.set(item.fn.file, entries);
  }

  const batches: PreparedFunction[][] = [];
  for (const entries of byFile.values()) {
    entries.sort((a, b) => a.fn.startLine - b.fn.startLine);

    let current: PreparedFunction[] = [];
    let currentTokens = 0;

    for (const item of entries) {
      const fnTokens = item.promptTokenEstimate;
      const wouldOverflowCount = current.length >= MAX_BATCH_FUNCTIONS;
      const wouldOverflowTokens = currentTokens + fnTokens > MAX_BATCH_TOKENS;

      if (current.length > 0 && (wouldOverflowCount || wouldOverflowTokens)) {
        batches.push(current);
        current = [];
        currentTokens = 0;
      }

      current.push(item);
      currentTokens += fnTokens;
    }

    if (current.length > 0) {
      batches.push(current);
    }
  }

  return batches;
}

async function requestBatchWithRetry(task: BatchTask, client: LlmClient, expectedIds: Set<string>): Promise<{ response: string; models: Map<string, FunctionResourceModel> }> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const retrySuffix =
      attempt === 0
        ? ""
        : "\n\nIMPORTANT: respond ONLY with valid JSON and include one model for each provided function_id.";

    try {
      const response = await client.analyze(`${task.promptPayload}${retrySuffix}`);
      const models = parseBatchModelResponse(response);

      const unknownIds = [...models.keys()].filter((id) => !expectedIds.has(id));
      if (unknownIds.length > 0) {
        throw new Error(`unknown function_id in batch response: ${unknownIds.join(", ")}`);
      }

      return { response, models };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError ?? new Error("Batch model request failed");
}

export async function runModeler(functions: ScannedFunction[], options: ModelerOptions): Promise<ModelerResult> {
  const modeledById = new Map<string, ModeledFunction>();
  const deterministicById = new Map<string, FunctionResourceModel>();
  const pending: PreparedFunction[] = [];

  let apiCalls = 0;
  let cacheHits = 0;
  let totalCostUsd = 0;
  let reservedCostUsd = 0;
  let incomplete = false;
  let incompleteReason: string | undefined;

  const hasApiKey = Boolean(extractProviderApiKey(options.provider, options.apiKey)) || options.provider === "ollama";
  const llmEnabled = options.enableLlm !== false && hasApiKey;
  const languages = [...new Set(functions.map((fn) => fn.language))];
  const analyzePromptAssets = await loadAnalyzePromptAssets(languages);
  const batchPromptAssets = await loadBatchPromptAssets(languages);

  const llmClient = llmEnabled
    ? createLlmClient({
        provider: options.provider,
        model: options.model,
        apiKey: extractProviderApiKey(options.provider, options.apiKey),
        baseUrl: options.baseUrl
      })
    : null;

  for (const fn of functions) {
    const deterministicModel = buildDeterministicModel(fn);
    deterministicById.set(fn.id, deterministicModel);

    const promptData = await buildAnalyzePrompt(fn, analyzePromptAssets);
    const promptPayload = options.redactSecrets ? redactSecrets(promptData.prompt).output : promptData.prompt;
    const promptFingerprint = promptPayload === promptData.prompt ? promptData.promptFingerprint : sha256(promptPayload);
    const cacheKey = buildCacheKey({
      sourceCode: fn.source,
      promptFingerprint,
      modelerVersion: MODELER_VERSION,
      redactionPolicyVersion: redactionPolicyVersion(options.redactSecrets)
    });

    if (!options.noCache) {
      const cached = await getCache<ModeledFunction>(cacheKey);
      if (cached) {
        modeledById.set(fn.id, { ...cached, cacheHit: true });
        cacheHits += 1;
        continue;
      }
    }

    if (!llmClient || deterministicModel.resources.length === 0) {
      const modeled: ModeledFunction = {
        functionId: fn.id,
        model: deterministicModel,
        origin: "deterministic_high",
        cacheHit: false
      };
      modeledById.set(fn.id, modeled);
      if (!options.noCache) {
        await setCache(cacheKey, modeled);
      }
      continue;
    }

    pending.push({
      fn,
      deterministicModel,
      cacheKey,
      promptTokenEstimate: estimateTokensFromChars(promptPayload)
    });
  }

  if (pending.length > 0 && llmClient) {
    const rawBatches = createBatches(pending);
    const executableTasks: BatchTask[] = [];
    const skippedByCost = new Set<string>();

    for (const batch of rawBatches) {
      const promptData = await buildAnalyzeBatchPrompt(
        batch.map((item) => item.fn),
        batchPromptAssets
      );
      const promptPayload = options.redactSecrets ? redactSecrets(promptData.prompt).output : promptData.prompt;
      const estimatedCost = estimateCost(options.model, promptPayload).totalUsd;

      if (options.costLimit !== undefined && totalCostUsd + reservedCostUsd + estimatedCost > options.costLimit) {
        incomplete = true;
        incompleteReason = "cost_limit_reached";
        for (const item of batch) {
          skippedByCost.add(item.fn.id);
        }
        continue;
      }

      reservedCostUsd += estimatedCost;
      executableTasks.push({
        items: batch,
        promptPayload,
        estimatedCost
      });
    }

    const workerCount = Math.max(1, Math.min(options.parallel, executableTasks.length));
    let nextTaskIndex = 0;

    const workers = Array.from({ length: workerCount }, () =>
      (async () => {
        while (true) {
          const taskIndex = nextTaskIndex;
          nextTaskIndex += 1;
          if (taskIndex >= executableTasks.length) {
            return;
          }

          const task = executableTasks[taskIndex];
          const expectedIds = new Set(task.items.map((item) => item.fn.id));

          try {
            const { response, models } = await requestBatchWithRetry(task, llmClient, expectedIds);
            apiCalls += 1;

            const finalCost = estimateCost(options.model, task.promptPayload, response).totalUsd;
            reservedCostUsd -= task.estimatedCost;
            totalCostUsd += finalCost;

            for (const item of task.items) {
              const llmModel = models.get(item.fn.id);

              if (!llmModel) {
                const skipped: ModeledFunction = {
                  functionId: item.fn.id,
                  model: item.deterministicModel,
                  origin: "skipped",
                  skippedReason: "missing_model_for_function_id",
                  cacheHit: false
                };
                modeledById.set(item.fn.id, skipped);
                continue;
              }

              const merged = mergeModels(item.deterministicModel, llmModel);
              const modeled: ModeledFunction = {
                functionId: item.fn.id,
                model: merged,
                origin: "llm_hybrid",
                cacheHit: false
              };
              modeledById.set(item.fn.id, modeled);

              if (!options.noCache) {
                await setCache(item.cacheKey, modeled);
              }
            }
          } catch (error) {
            reservedCostUsd -= task.estimatedCost;
            options.logger.warn("Batch LLM modeling failed, using deterministic fallback", {
              error: error instanceof Error ? error.message : String(error),
              batchSize: task.items.length,
              functionIds: task.items.map((item) => item.fn.id)
            });

            for (const item of task.items) {
              const fallback: ModeledFunction = {
                functionId: item.fn.id,
                model: item.deterministicModel,
                origin: "deterministic_high",
                cacheHit: false
              };
              modeledById.set(item.fn.id, fallback);
              if (!options.noCache) {
                await setCache(item.cacheKey, fallback);
              }
            }
          }
        }
      })()
    );

    await Promise.all(workers);

    for (const item of pending) {
      if (!skippedByCost.has(item.fn.id)) {
        continue;
      }

      const skipped: ModeledFunction = {
        functionId: item.fn.id,
        model: item.deterministicModel,
        origin: "skipped",
        skippedReason: "cost_limit_reached",
        cacheHit: false
      };
      modeledById.set(item.fn.id, skipped);
    }
  }

  const modeledFunctions = functions.map((fn) => {
    const modeled = modeledById.get(fn.id);
    if (modeled) {
      return modeled;
    }

    return {
      functionId: fn.id,
      model: deterministicById.get(fn.id) ?? { resources: [], summary: { totalResources: 0, totalPaths: 0, pathsWithMissingRelease: 0, riskLevel: "none" } },
      origin: "deterministic_high",
      cacheHit: false
    } satisfies ModeledFunction;
  });

  return {
    functions: modeledFunctions,
    apiCalls,
    cacheHits,
    totalCostUsd,
    incomplete,
    incompleteReason
  };
}
