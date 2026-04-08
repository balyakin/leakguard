import chalk from "chalk";
import type { Defect } from "../types/defect.js";

export interface TerminalRenderMeta {
  scannedFiles: number;
  scannedFunctions: number;
  resourceFunctions: number;
  changedOnly: boolean;
  baselineFiltered: number;
  apiCalls: number;
  cacheHits: number;
  timeSeconds: number;
}

function severityLabel(defect: Defect): string {
  if (defect.severity === "critical") {
    return chalk.bgRed.white.bold(" CRITICAL ");
  }
  if (defect.severity === "warning") {
    return chalk.yellow.bold("WARNING");
  }
  return chalk.cyan("INFO");
}

function printPath(defect: Defect): string {
  const symbol = chalk.red("✗");
  const path = `${symbol} Path: ${defect.missingRelease.pathDescription}`;
  const message = `${defect.missingRelease.expectedRelease} is NOT called before exit.`;
  return `${path}\n    ${message}`;
}

export function renderTerminalReport(defects: Defect[], meta: TerminalRenderMeta): string {
  const lines: string[] = [];

  lines.push(` LeakGuard v0.1.0 — Resource Leak Detector`);
  lines.push("");
  lines.push(` Scanned: ${meta.scannedFiles} files, ${meta.scannedFunctions} functions`);
  lines.push(` Functions with resources: ${meta.resourceFunctions}`);
  lines.push("");
  lines.push(" ──────────────────────────────────────────────────────────");

  if (defects.length === 0) {
    lines.push("");
    lines.push(` ${chalk.green("No findings above threshold.")}`);
  }

  for (const defect of defects) {
    lines.push("");
    lines.push(
      ` ${severityLabel(defect)}  ${chalk.underline(defect.file)}:${defect.line}  ${defect.function}()`
    );
    lines.push("");
    lines.push(`   ${defect.title}`);
    lines.push("");
    lines.push(`   Resource: ${defect.resource.variable} (${defect.resource.type})`);
    lines.push(
      `   Acquired at line ${defect.resource.acquiredAt.line}: ${chalk.gray(defect.resource.acquiredAt.expression)}`
    );
    lines.push("");
    lines.push(`   ${printPath(defect)}`);
    lines.push(`   Trace: ${defect.trace.path.join(" -> ")}`);
    lines.push("");
    lines.push(`   Suggestion: ${defect.suggestion}`);
    if (defect.autofix.available && defect.autofix.patchPreview) {
      lines.push(`   Autofix: available (${defect.autofix.safety})`);
    }
    lines.push(`   Confidence: ${defect.confidence.toUpperCase()} | ${defect.relatedCwe} | ID: ${defect.id}`);
    lines.push("");
    lines.push(" ──────────────────────────────────────────────────────────");
  }

  const counts = {
    critical: defects.filter((defect) => defect.severity === "critical").length,
    warning: defects.filter((defect) => defect.severity === "warning").length,
    info: defects.filter((defect) => defect.severity === "info").length
  };

  lines.push("");
  lines.push(` Summary: ${counts.critical} critical, ${counts.warning} warning, ${counts.info} info`);
  lines.push(
    ` Mode: changed-only=${meta.changedOnly} | Baseline filtered: ${meta.baselineFiltered}`
  );
  lines.push(` API calls: ${meta.apiCalls} | Cache hits: ${meta.cacheHits} | Time: ${meta.timeSeconds.toFixed(1)}s`);

  return `${lines.join("\n")}\n`;
}
