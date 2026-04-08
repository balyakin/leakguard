import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Defect, VerificationResult } from "../types/defect.js";
import type { ModeledFunction } from "../types/model.js";
import type { ScannedFunction } from "../types/scan.js";
import { sha1 } from "../utils/hash.js";
import { calculateConfidence } from "./confidence.js";
import { filterFalsePositives } from "./false-positive.js";
import { isPathReachable } from "./path-checker.js";

const INLINE_IGNORE_TAG = "leakguard:ignore";

function isTestFile(filePath: string): boolean {
  return (
    /(^|\/)(test|tests|__tests__)\//.test(filePath) ||
    /\.(test|spec)\.[A-Za-z0-9]+$/.test(filePath) ||
    /_test\.(go|py|ts|tsx|js|jsx|java|rs|c|cpp)$/.test(filePath)
  );
}

function severityForResource(type: Defect["resource"]["type"], scanned: ScannedFunction): Defect["severity"] {
  let baseSeverity: Defect["severity"];

  if (type === "transaction" || type === "lock" || type === "memory") {
    baseSeverity = "critical";
  } else if (type === "custom") {
    baseSeverity = "info";
  } else {
    baseSeverity = "warning";
  }

  if (isTestFile(scanned.file) || scanned.function === "main") {
    return "info";
  }

  return baseSeverity;
}

function expectedRelease(resourceType: Defect["resource"]["type"], variable: string): string {
  switch (resourceType) {
    case "transaction":
      return `${variable}.Rollback()`;
    case "lock":
      return `${variable}.Unlock()`;
    case "memory":
      return `free(${variable})`;
    case "context":
      return "cancel()";
    case "channel":
      return `close(${variable})`;
    default:
      return `${variable}.Close()`;
  }
}

function suggestionFor(fn: ScannedFunction, variable: string, expected: string): string {
  if (fn.language === "go") {
    return `Add 'defer ${expected}' immediately after ${variable} is acquired.`;
  }
  if (fn.language === "python") {
    return `Wrap the resource with 'with' or close it in a finally block using '${expected}'.`;
  }
  if (fn.language === "typescript") {
    return `Use try/finally and call '${expected}' in the finally block.`;
  }
  return `Ensure '${expected}' executes on all return and error paths.`;
}

function autofixPreview(fn: ScannedFunction, expected: string, acquireLine: number): string | undefined {
  if (fn.language !== "go") {
    return undefined;
  }
  return `@@ -${acquireLine},0 +${acquireLine + 1} @@\n+defer ${expected}`;
}

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasGlobalCleanup(moduleSource: string, fn: ScannedFunction, variable: string): boolean {
  const lines = moduleSource.split(/\r?\n/);
  const globalCleanupPattern = /\b(cleanup|closeAll|releaseAll|shutdownAll)\s*\(/i;
  const variableCleanupPattern = new RegExp(
    `\\b${escapeForRegex(variable)}\\s*\\.\\s*(Close|close|Rollback|rollback|Unlock|unlock|Release|release)\\s*\\(`
  );

  if (globalCleanupPattern.test(moduleSource)) {
    return true;
  }

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    if (lineNumber >= fn.startLine && lineNumber <= fn.endLine) {
      continue;
    }
    if (variableCleanupPattern.test(lines[index])) {
      return true;
    }
  }

  return false;
}

function hasPotentialImplicitRelease(
  fn: ScannedFunction,
  moduleSource: string,
  variable: string,
  fromLine: number,
  toLine: number
): boolean {
  const localLines = fn.source.split(/\r?\n/);
  const start = Math.max(0, fromLine - fn.startLine);
  const end = Math.min(localLines.length - 1, toLine - fn.startLine);

  for (let i = start; i <= end; i += 1) {
    if (/\b(cleanup|closeAll|releaseAll|shutdownAll)\s*\(/i.test(localLines[i])) {
      return true;
    }
  }

  return hasGlobalCleanup(moduleSource, fn, variable);
}

function lineExists(fn: ScannedFunction, line: number): boolean {
  return line >= fn.startLine && line <= fn.endLine;
}

function hasInlineIgnore(scanned: ScannedFunction, moduleSource: string, line: number): boolean {
  if (scanned.source.includes(INLINE_IGNORE_TAG)) {
    return true;
  }

  const lines = moduleSource.split(/\r?\n/);
  const inspect = [line - 1, line, scanned.startLine - 1, scanned.startLine];
  for (const currentLine of inspect) {
    if (currentLine < 1 || currentLine > lines.length) {
      continue;
    }
    if (lines[currentLine - 1].includes(INLINE_IGNORE_TAG)) {
      return true;
    }
  }

  return false;
}

function buildDefects(
  scanned: ScannedFunction,
  modeled: ModeledFunction,
  moduleSource: string
): { defects: Defect[]; suppressed: number } {
  const defects: Defect[] = [];
  let suppressed = 0;

  if (modeled.origin === "skipped") {
    return { defects, suppressed };
  }

  const origin = modeled.origin;

  for (const resource of modeled.model.resources) {
    const expected = expectedRelease(resource.type, resource.acquire.variable);

    for (const path of resource.executionPaths) {
      if (path.resourceReleased) {
        continue;
      }

      const leakingExitLine = path.lines[1];

      if (hasInlineIgnore(scanned, moduleSource, leakingExitLine)) {
        suppressed += 1;
        continue;
      }

      const pathVerified = isPathReachable(scanned.cfg, resource.acquire.line, leakingExitLine);
      const linesVerified = lineExists(scanned, resource.acquire.line) && lineExists(scanned, leakingExitLine);
      const implicitRelease = hasPotentialImplicitRelease(
        scanned,
        moduleSource,
        resource.acquire.variable,
        resource.acquire.line,
        leakingExitLine
      );

      const confidence = calculateConfidence({
        origin,
        pathVerified,
        linesVerified,
        hasPotentialImplicitRelease: implicitRelease
      });

      const fingerprint = sha1(`${scanned.file}${scanned.function}${resource.acquire.line}${leakingExitLine}${expected}`);
      const id = `LG-${fingerprint.slice(0, 8)}`;

      defects.push({
        id,
        fingerprint,
        origin,
        severity: severityForResource(resource.type, scanned),
        confidence,
        title: `${resource.type} not released on execution path`,
        file: scanned.file,
        function: scanned.function,
        line: leakingExitLine,
        resource: {
          type: resource.type,
          acquiredAt: {
            line: resource.acquire.line,
            expression: resource.acquire.expression
          },
          variable: resource.acquire.variable
        },
        missingRelease: {
          pathDescription: path.description,
          expectedRelease: expected,
          exitPoint: {
            line: leakingExitLine,
            type: "return"
          }
        },
        trace: {
          acquireLine: resource.acquire.line,
          branchLines: [],
          leakingExitLine,
          path: [resource.acquire.line, leakingExitLine]
        },
        suggestion: suggestionFor(scanned, resource.acquire.variable, expected),
        autofix: {
          available: scanned.language === "go",
          safety: scanned.language === "go" ? "safe" : "none",
          patchPreview: autofixPreview(scanned, expected, resource.acquire.line)
        },
        relatedCwe: "CWE-772"
      });
    }
  }

  return { defects, suppressed };
}

function readModuleSource(file: string): string {
  const absolutePath = resolve(process.cwd(), file);
  if (!existsSync(absolutePath)) {
    return "";
  }
  return readFileSync(absolutePath, "utf8");
}

export function runVerifier(scannedFunctions: ScannedFunction[], modeledFunctions: ModeledFunction[]): VerificationResult {
  const scannedByFunctionId = new Map(scannedFunctions.map((fn) => [fn.id, fn]));
  const moduleSourceCache = new Map<string, string>();
  const defects: Defect[] = [];
  let suppressedByIgnore = 0;

  for (const modeled of modeledFunctions) {
    const scanned = scannedByFunctionId.get(modeled.functionId);
    if (!scanned) {
      continue;
    }

    let moduleSource = moduleSourceCache.get(scanned.file);
    if (moduleSource === undefined) {
      moduleSource = readModuleSource(scanned.file);
      moduleSourceCache.set(scanned.file, moduleSource);
    }

    const built = buildDefects(scanned, modeled, moduleSource);
    defects.push(...built.defects);
    suppressedByIgnore += built.suppressed;
  }

  const filtered = filterFalsePositives(defects);
  return {
    defects: filtered.kept,
    filteredFalsePositives: filtered.filtered + suppressedByIgnore
  };
}
