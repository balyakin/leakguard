import type { ErrorHandler, ExitPoint, Language, ScannedCall } from "../types/scan.js";
import { getLanguageRules } from "./languages/index.js";

export interface FunctionFlowSignals {
  calls: ScannedCall[];
  exitPoints: ExitPoint[];
  errorHandlers: ErrorHandler[];
}

const CALL_REGEX = /([A-Za-z_][A-Za-z0-9_:\.->]*)\s*\(/g;

function detectVariableName(line: string): string | undefined {
  const withMatch = line.match(/\bas\s+([A-Za-z_]\w*)\b/);
  if (withMatch) {
    return withMatch[1];
  }

  if (!line.includes("=")) {
    return undefined;
  }

  const [leftRaw] = line.split("=");
  const left = leftRaw.replace(/:=/g, "=").trim();
  if (!left) {
    return undefined;
  }

  const first = left.split(",")[0]?.trim() ?? "";
  const match = first.match(/([A-Za-z_]\w*)\s*$/);
  return match?.[1];
}

function classifyCall(language: Language, callName: string): ScannedCall["category"] {
  const rules = getLanguageRules(language);
  if (rules.acquirePatterns.some((pattern) => pattern.test(callName))) {
    return "resource_acquire";
  }
  if (rules.releasePatterns.some((pattern) => pattern.test(callName))) {
    return "resource_release";
  }
  return "other";
}

function detectExitPointType(line: string): ExitPoint["type"] | null {
  if (/\breturn\b/.test(line)) {
    return "return";
  }
  if (/\bthrow\b/.test(line)) {
    return "throw";
  }
  if (/\bpanic\s*\(/.test(line)) {
    return "panic";
  }
  if (/\b(?:os\.)?exit\s*\(/.test(line)) {
    return "exit";
  }
  if (/\bbreak\b/.test(line)) {
    return "break";
  }
  if (/\bcontinue\b/.test(line)) {
    return "continue";
  }
  return null;
}

function detectErrorHandlerType(line: string): string | null {
  if (/\bif\s+err\s*!=\s*nil\b/.test(line)) {
    return "if_err_check";
  }
  if (/\bcatch\b/.test(line)) {
    return "catch";
  }
  if (/\bexcept\b/.test(line)) {
    return "except";
  }
  if (/\bfinally\b/.test(line)) {
    return "finally";
  }
  if (/\bdefer\b/.test(line)) {
    return "defer";
  }
  if (/\.catch\s*\(/.test(line)) {
    return "promise_catch";
  }
  if (/\bif\b.*\berr(or)?\b/i.test(line)) {
    return "error_conditional";
  }
  return null;
}

export function detectFunctionFlowSignals(language: Language, source: string, startLine: number): FunctionFlowSignals {
  const calls: ScannedCall[] = [];
  const exitPoints: ExitPoint[] = [];
  const errorHandlers: ErrorHandler[] = [];
  const lines = source.split(/\r?\n/);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const lineNumber = startLine + i;

    for (const match of line.matchAll(CALL_REGEX)) {
      const callName = match[1];
      const category = classifyCall(language, callName);

      calls.push({
        name: callName,
        line: lineNumber,
        category,
        variable: category === "resource_acquire" ? detectVariableName(line) : undefined
      });
    }

    const exitType = detectExitPointType(line);
    if (exitType) {
      const inErrorHandler = /\b(?:err|error|catch|except|timeout)\b/i.test(line);
      exitPoints.push({ type: exitType, line: lineNumber, inErrorHandler });
    }

    const errorType = detectErrorHandlerType(line);
    if (errorType) {
      errorHandlers.push({
        type: errorType,
        startLine: lineNumber,
        endLine: lineNumber
      });
    }
  }

  return { calls, exitPoints, errorHandlers };
}

export function isResourceRelevant(calls: ScannedCall[]): boolean {
  return calls.some((call) => call.category === "resource_acquire" || call.category === "resource_release");
}
