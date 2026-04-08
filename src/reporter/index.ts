import type { Defect } from "../types/defect.js";
import type { OutputFormat } from "../types/config.js";
import { renderHtmlReport } from "./html.js";
import { renderJsonReport } from "./json.js";
import { renderMarkdownReport } from "./markdown.js";
import { renderSarifReport } from "./sarif.js";
import { renderTerminalReport } from "./terminal.js";

export interface ReportMeta {
  generatedAt: string;
  scannedFiles: number;
  scannedFunctions: number;
  resourceFunctions: number;
  changedOnly: boolean;
  baselineFiltered: number;
  apiCalls: number;
  cacheHits: number;
  timeSeconds: number;
  incomplete: boolean;
  incompleteReason?: string;
}

export async function renderReport(format: OutputFormat, defects: Defect[], meta: ReportMeta): Promise<string> {
  switch (format) {
    case "terminal":
      return renderTerminalReport(defects, {
        scannedFiles: meta.scannedFiles,
        scannedFunctions: meta.scannedFunctions,
        resourceFunctions: meta.resourceFunctions,
        changedOnly: meta.changedOnly,
        baselineFiltered: meta.baselineFiltered,
        apiCalls: meta.apiCalls,
        cacheHits: meta.cacheHits,
        timeSeconds: meta.timeSeconds
      });
    case "json":
      return renderJsonReport(defects, {
        generatedAt: meta.generatedAt,
        scannedFiles: meta.scannedFiles,
        scannedFunctions: meta.scannedFunctions,
        resourceFunctions: meta.resourceFunctions,
        apiCalls: meta.apiCalls,
        cacheHits: meta.cacheHits,
        baselineFiltered: meta.baselineFiltered,
        incomplete: meta.incomplete,
        incompleteReason: meta.incompleteReason
      });
    case "sarif":
      return renderSarifReport(defects);
    case "html":
      return renderHtmlReport(defects);
    case "markdown":
      return renderMarkdownReport(defects);
    default:
      throw new Error(`Unsupported output format: ${format}`);
  }
}
