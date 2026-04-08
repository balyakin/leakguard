import { resolve } from "node:path";
import { Command } from "commander";
import type { Defect } from "../../types/defect.js";
import type { OutputFormat } from "../../types/config.js";
import { renderReport } from "../../reporter/index.js";
import { readJson } from "../../utils/file.js";
import { emitOutput } from "../output.js";

interface LastScanFile {
  scanner: {
    files: number;
    functions: number;
    resourceFunctions: number;
  };
  modeler: {
    apiCalls: number;
    cacheHits: number;
    incomplete: boolean;
    incompleteReason?: string;
  };
  findings: Defect[];
  generatedAt: string;
}

export function registerReportCommand(program: Command): void {
  program
    .command("report")
    .description("Generate report from .leakguard/last-scan.json")
    .option("-f, --format <format>", "terminal|json|sarif|html|markdown", "html")
    .option("-o, --output <path>", "output path")
    .action(async (options: { format: OutputFormat; output?: string }) => {
      const scanPath = resolve(process.cwd(), ".leakguard", "last-scan.json");
      const scan = await readJson<LastScanFile>(scanPath);

      const report = await renderReport(options.format, scan.findings, {
        generatedAt: scan.generatedAt,
        scannedFiles: scan.scanner.files,
        scannedFunctions: scan.scanner.functions,
        resourceFunctions: scan.scanner.resourceFunctions,
        changedOnly: false,
        baselineFiltered: 0,
        apiCalls: scan.modeler.apiCalls,
        cacheHits: scan.modeler.cacheHits,
        timeSeconds: 0,
        incomplete: scan.modeler.incomplete,
        incompleteReason: scan.modeler.incompleteReason
      });

      await emitOutput(report, options.output);
    });
}
