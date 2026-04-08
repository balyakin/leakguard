import type { Defect } from "../types/defect.js";

export function renderMarkdownReport(defects: Defect[]): string {
  const lines: string[] = [];

  lines.push("# LeakGuard Report");
  lines.push("");
  lines.push(`Findings: **${defects.length}**`);
  lines.push("");

  if (defects.length === 0) {
    lines.push("No findings above threshold.");
    lines.push("");
    return `${lines.join("\n")}\n`;
  }

  for (const defect of defects) {
    lines.push(`## ${defect.severity.toUpperCase()} ${defect.file}:${defect.line} ${defect.function}()`);
    lines.push("");
    lines.push(`- ID: ${defect.id}`);
    lines.push(`- Title: ${defect.title}`);
    lines.push(`- Resource: ${defect.resource.variable} (${defect.resource.type})`);
    lines.push(`- Expected release: ${defect.missingRelease.expectedRelease}`);
    lines.push(`- Path: ${defect.missingRelease.pathDescription}`);
    lines.push(`- Suggestion: ${defect.suggestion}`);
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}
