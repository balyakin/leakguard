import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { Command } from "commander";
import ora from "ora";
import type { Defect, BaselineFile } from "../../types/defect.js";
import type { Confidence, Severity } from "../../types/defect.js";
import type { LeakGuardConfig, ScanRunOptions } from "../../types/config.js";
import type { Language } from "../../types/scan.js";
import { loadConfig } from "../../config/load.js";
import { runModeler } from "../../modeler/index.js";
import { renderReport } from "../../reporter/index.js";
import { runScanner } from "../../scanner/index.js";
import { readJson, readTextIfExists, writeJson, writeText } from "../../utils/file.js";
import { getChangedFiles } from "../../utils/git.js";
import { createLogger } from "../../utils/logger.js";
import { runVerifier } from "../../verifier/index.js";
import { applyScanOptions } from "../options.js";
import { emitOutput } from "../output.js";

const SEVERITY_RANK: Record<Severity, number> = {
  info: 0,
  warning: 1,
  critical: 2
};

const CONFIDENCE_RANK: Record<Confidence, number> = {
  low: 0,
  medium: 1,
  high: 2
};

function toArray(value: string | undefined, fallback: string[]): string[] {
  if (!value) {
    return fallback;
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function applyThresholds(defects: Defect[], severity: Severity, confidence: Confidence): Defect[] {
  return defects.filter(
    (defect) => SEVERITY_RANK[defect.severity] >= SEVERITY_RANK[severity] && CONFIDENCE_RANK[defect.confidence] >= CONFIDENCE_RANK[confidence]
  );
}

async function loadBaseline(path: string): Promise<BaselineFile | null> {
  const text = await readTextIfExists(resolve(process.cwd(), path));
  if (!text) {
    return null;
  }
  return JSON.parse(text) as BaselineFile;
}

function filterByBaseline(defects: Defect[], baseline: BaselineFile | null): { defects: Defect[]; filtered: number } {
  if (!baseline) {
    return { defects, filtered: 0 };
  }

  const known = new Set(baseline.findings.map((entry) => entry.fingerprint));
  const remaining = defects.filter((defect) => !known.has(defect.fingerprint));
  return {
    defects: remaining,
    filtered: defects.length - remaining.length
  };
}

async function maybeUpdateBaseline(path: string, defects: Defect[], enabled: boolean): Promise<void> {
  if (!enabled) {
    return;
  }

  const baseline: BaselineFile = {
    version: 1,
    generatedAt: new Date().toISOString(),
    findings: defects.map((defect) => ({
      id: defect.id,
      fingerprint: defect.fingerprint,
      file: defect.file,
      line: defect.line,
      severity: defect.severity,
      confidence: defect.confidence
    }))
  };

  await writeJson(resolve(process.cwd(), path), baseline);
}

function mergeOptions(config: LeakGuardConfig, pathArg: string | undefined, cli: Partial<ScanRunOptions>): ScanRunOptions {
  const commanderLike = cli as Partial<ScanRunOptions> & {
    cache?: boolean;
    redactSecrets?: boolean;
  };

  const noCache =
    cli.noCache ?? (commanderLike.cache !== undefined ? !commanderLike.cache : false);
  const noRedactSecrets =
    cli.noRedactSecrets ??
    (commanderLike.redactSecrets !== undefined ? !commanderLike.redactSecrets : !config.api.redactSecrets);

  return {
    path: pathArg ?? ".",
    format: cli.format ?? config.report.format,
    output: cli.output,
    language: cli.language,
    severity: cli.severity ?? config.report.severity,
    confidence: cli.confidence ?? config.report.confidence,
    include: cli.include ?? config.scan.include.join(","),
    exclude: cli.exclude ?? config.scan.exclude.join(","),
    changed: cli.changed ?? config.scan.changedOnly,
    baseRef: cli.baseRef ?? config.scan.baseRef,
    baseline: cli.baseline ?? config.scan.baselineFile,
    updateBaseline: cli.updateBaseline ?? config.scan.updateBaseline,
    maxFunctions: cli.maxFunctions ?? config.scan.maxFunctions,
    minFunctionLines: config.scan.minFunctionLines,
    noCache,
    verbose: cli.verbose ?? false,
    dryRun: cli.dryRun ?? false,
    apiProvider: cli.apiProvider ?? config.api.provider,
    model: cli.model ?? config.api.model,
    parallel: cli.parallel ?? config.api.parallel,
    costLimit: cli.costLimit ?? config.api.costLimit,
    noRedactSecrets,
    fix: cli.fix ?? config.report.includeAutofix,
    requireComplete: cli.requireComplete ?? config.ci.requireComplete,
    disableLlm: cli.disableLlm ?? false
  };
}

interface ScanExecutionResult {
  exitCode: number;
}

export async function executeScan(raw: ScanRunOptions): Promise<ScanExecutionResult> {
  const startedAt = Date.now();
  const logger = createLogger(raw.verbose);
  const spinner = ora({ text: "Scanning codebase..." }).start();

  let changedFiles: Set<string> | undefined;
  if (raw.changed) {
    try {
      changedFiles = await getChangedFiles(raw.baseRef);
    } catch (error) {
      spinner.fail("Failed to resolve changed files");
      throw error;
    }
  }
  const languages: Language[] = raw.language
    ? [raw.language]
    : ["go", "python", "typescript", "java", "rust", "c", "cpp"];

  const scannerResult = await runScanner({
    targetPath: raw.path,
    include: toArray(raw.include, ["**/*"]),
    exclude: toArray(raw.exclude, []),
    languages,
    forceLanguage: raw.language,
    changedFiles,
    maxFunctions: raw.maxFunctions,
    minFunctionLines: raw.minFunctionLines ?? 5,
    logger
  });

  if (raw.dryRun) {
    spinner.succeed("Dry run finished");
    const text = [
      "LeakGuard dry run",
      `Path: ${raw.path}`,
      `Files discovered: ${scannerResult.summary.files}`,
      `Functions discovered: ${scannerResult.summary.functions}`,
      `Functions with resources: ${scannerResult.summary.resourceFunctions}`
    ].join("\n");
    await emitOutput(`${text}\n`, raw.output);
    return { exitCode: 0 };
  }

  spinner.text = "Modeling resources...";
  const modelerResult = await runModeler(scannerResult.functions, {
    provider: raw.apiProvider,
    model: raw.model,
    noCache: raw.noCache,
    redactSecrets: !raw.noRedactSecrets,
    parallel: raw.parallel,
    costLimit: raw.costLimit,
    logger,
    enableLlm: !raw.disableLlm
  });

  spinner.text = "Verifying findings...";
  const verification = runVerifier(scannerResult.functions, modelerResult.functions);
  const thresholded = applyThresholds(verification.defects, raw.severity, raw.confidence);
  const baseline = await loadBaseline(raw.baseline);
  const baselineFiltered = filterByBaseline(thresholded, baseline);
  await maybeUpdateBaseline(raw.baseline, thresholded, raw.updateBaseline);

  const elapsed = (Date.now() - startedAt) / 1000;
  const report = await renderReport(raw.format, baselineFiltered.defects, {
    generatedAt: new Date().toISOString(),
    scannedFiles: scannerResult.summary.files,
    scannedFunctions: scannerResult.summary.functions,
    resourceFunctions: scannerResult.summary.resourceFunctions,
    changedOnly: raw.changed,
    baselineFiltered: baselineFiltered.filtered,
    apiCalls: modelerResult.apiCalls,
    cacheHits: modelerResult.cacheHits,
    timeSeconds: elapsed,
    incomplete: modelerResult.incomplete,
    incompleteReason: modelerResult.incompleteReason
  });

  spinner.succeed("Scan completed");
  await emitOutput(report, raw.output);

  await mkdir(resolve(process.cwd(), ".leakguard"), { recursive: true });
  await writeJson(resolve(process.cwd(), ".leakguard", "last-scan.json"), {
    generatedAt: new Date().toISOString(),
    options: raw,
    scanner: scannerResult.summary,
    modeler: {
      apiCalls: modelerResult.apiCalls,
      cacheHits: modelerResult.cacheHits,
      incomplete: modelerResult.incomplete,
      incompleteReason: modelerResult.incompleteReason
    },
    findings: baselineFiltered.defects
  });

  if (modelerResult.incomplete && raw.requireComplete) {
    await writeText(
      resolve(process.cwd(), ".leakguard", "last-scan-status.txt"),
      "Scan incomplete: cost limit reached.\n"
    );
    return { exitCode: 3 };
  }

  if (baselineFiltered.defects.length > 0) {
    return { exitCode: 1 };
  }

  return { exitCode: 0 };
}

export function registerScanCommand(program: Command): void {
  const scan = applyScanOptions(new Command("scan"))
    .argument("[path]", "path to file or directory", ".")
    .description("Scan source code for resource lifecycle leaks")
    .action(async (path: string, cliOptions: Partial<ScanRunOptions>) => {
      const config = await loadConfig();
      const options = mergeOptions(config, path, cliOptions);
      const result = await executeScan(options);
      process.exitCode = result.exitCode;
    });

  program.addCommand(scan);
}
