import { Ajv } from "ajv";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { FunctionResourceModel } from "../types/model.js";

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const schemaCandidates = [
  resolve(process.cwd(), "schemas/model-response.json"),
  resolve(CURRENT_DIR, "../../schemas/model-response.json"),
  resolve(CURRENT_DIR, "../schemas/model-response.json")
];

const schemaPath = schemaCandidates.find((path) => existsSync(path));
if (!schemaPath) {
  throw new Error("Unable to locate schemas/model-response.json");
}

const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

function parseJsonPayload(jsonText: string): Record<string, unknown> {
  try {
    return JSON.parse(jsonText) as Record<string, unknown>;
  } catch {
    const start = jsonText.indexOf("{");
    const end = jsonText.lastIndexOf("}");
    if (start < 0 || end < start) {
      throw new Error("LLM response does not contain a JSON object");
    }
    const candidate = jsonText.slice(start, end + 1);
    return JSON.parse(candidate) as Record<string, unknown>;
  }
}

function toCamelCaseModel(input: Record<string, unknown>): FunctionResourceModel {
  const summary = (input.summary ?? {}) as Record<string, unknown>;
  const resourcesRaw = Array.isArray(input.resources) ? input.resources : [];

  const resources = resourcesRaw.map((resourceRaw, index) => {
    const resource = resourceRaw as Record<string, any>;
    const acquire = resource.acquire ?? {};

    return {
      id: (resource.id as string) ?? `resource_${index + 1}`,
      type: (resource.type as FunctionResourceModel["resources"][number]["type"]) ?? "custom",
      acquire: {
        expression: (acquire.expression as string) ?? "",
        line: Number(acquire.line ?? 0),
        variable: (acquire.variable as string) ?? "resource"
      },
      expectedReleases: Array.isArray(resource.expected_releases)
        ? resource.expected_releases.map((entry: Record<string, unknown>) => ({
            expression: String(entry.expression ?? ""),
            type: (entry.type as "normal" | "error" | "cleanup") ?? "cleanup",
            description: String(entry.description ?? "")
          }))
        : [],
      actualReleases: Array.isArray(resource.actual_releases)
        ? resource.actual_releases.map((entry: Record<string, unknown>) => ({
            expression: String(entry.expression ?? ""),
            line: Number(entry.line ?? 0),
            onPath: String(entry.on_path ?? ""),
            coversErrorPaths: Boolean(entry.covers_error_paths)
          }))
        : [],
      executionPaths: Array.isArray(resource.execution_paths)
        ? resource.execution_paths.map((entry: Record<string, unknown>, pathIndex: number) => ({
            id: String(entry.id ?? `path_${pathIndex + 1}`),
            description: String(entry.description ?? ""),
            lines: [
              Number((entry.lines as number[] | undefined)?.[0] ?? 0),
              Number((entry.lines as number[] | undefined)?.[1] ?? 0)
            ] as [number, number],
            branchLines: Array.isArray(entry.branch_lines)
              ? entry.branch_lines.map((line) => Number(line))
              : undefined,
            exitType:
              entry.exit_type === "return" ||
              entry.exit_type === "throw" ||
              entry.exit_type === "panic" ||
              entry.exit_type === "exit" ||
              entry.exit_type === "fallthrough"
                ? (entry.exit_type as FunctionResourceModel["resources"][number]["executionPaths"][number]["exitType"])
                : undefined,
            resourceReleased: Boolean(entry.resource_released),
            releaseMechanism: (entry.release_mechanism as
              | "direct_call"
              | "defer"
              | "finally"
              | "with_statement"
              | "RAII"
              | "none") ?? "none",
            notes: String(entry.notes ?? "")
          }))
        : []
    };
  });

  return {
    resources,
    summary: {
      totalResources: Number(summary.total_resources ?? resources.length),
      totalPaths: Number(summary.total_paths ?? resources.reduce((acc, resource) => acc + resource.executionPaths.length, 0)),
      pathsWithMissingRelease: Number(summary.paths_with_missing_release ?? 0),
      riskLevel: (summary.risk_level as "none" | "low" | "medium" | "high" | "critical") ?? "none"
    }
  };
}

export function parseModelResponse(jsonText: string): FunctionResourceModel {
  const parsed = parseJsonPayload(jsonText);
  if (!validate(parsed)) {
    throw new Error(`Model response does not match schema: ${ajv.errorsText(validate.errors)}`);
  }
  return toCamelCaseModel(parsed);
}

export function parseBatchModelResponse(jsonText: string): Map<string, FunctionResourceModel> {
  const parsed = parseJsonPayload(jsonText);
  if (!Array.isArray(parsed.functions)) {
    throw new Error("Batch model response must contain a 'functions' array");
  }

  const result = new Map<string, FunctionResourceModel>();

  for (const entryRaw of parsed.functions) {
    const entry = entryRaw as Record<string, unknown>;
    const functionId = typeof entry.function_id === "string" ? entry.function_id : null;
    const model = entry.model;

    if (!functionId || !model || typeof model !== "object") {
      continue;
    }

    if (!validate(model)) {
      throw new Error(`Invalid model for function_id '${functionId}': ${ajv.errorsText(validate.errors)}`);
    }

    result.set(functionId, toCamelCaseModel(model as Record<string, unknown>));
  }

  return result;
}
