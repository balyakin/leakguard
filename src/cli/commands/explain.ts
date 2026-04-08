import { resolve } from "node:path";
import { Command } from "commander";
import type { Defect } from "../../types/defect.js";
import { readJson } from "../../utils/file.js";

interface LastScanFile {
  findings: Defect[];
}

function buildExplanation(defect: Defect): string {
  const lines: string[] = [];
  lines.push(`Defect ${defect.id}`);
  lines.push("");
  lines.push(`Why this is a bug:`);
  lines.push(`- ${defect.title}`);
  lines.push(`- Resource '${defect.resource.variable}' is acquired at line ${defect.resource.acquiredAt.line} but not released on path: ${defect.missingRelease.pathDescription}.`);
  lines.push("");
  lines.push(`How it can fail in production:`);
  lines.push(`- Repeated execution may exhaust available resources (descriptors, transactions, locks, sockets).`);
  lines.push(`- Error paths become progressively slower or deadlocked depending on resource type.`);
  lines.push("");
  lines.push(`How to fix:`);
  lines.push(`- ${defect.suggestion}`);
  lines.push(`- Add cleanup close to acquisition and ensure it covers early returns and exceptions.`);
  lines.push("");
  lines.push(`Reference: ${defect.relatedCwe}`);
  return `${lines.join("\n")}\n`;
}

export function registerExplainCommand(program: Command): void {
  program
    .command("explain")
    .argument("<defect-id>", "LeakGuard defect id")
    .description("Explain one finding from the latest scan")
    .action(async (defectId: string) => {
      const scanPath = resolve(process.cwd(), ".leakguard", "last-scan.json");
      const scan = await readJson<LastScanFile>(scanPath);
      const defect = scan.findings.find((entry) => entry.id === defectId);

      if (!defect) {
        throw new Error(`Defect ${defectId} not found in ${scanPath}`);
      }

      process.stdout.write(buildExplanation(defect));
    });
}
