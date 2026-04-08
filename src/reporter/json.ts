import type { Defect } from "../types/defect.js";

export interface JsonRenderMeta {
  generatedAt: string;
  scannedFiles: number;
  scannedFunctions: number;
  resourceFunctions: number;
  apiCalls: number;
  cacheHits: number;
  baselineFiltered: number;
  incomplete: boolean;
  incompleteReason?: string;
}

export function renderJsonReport(defects: Defect[], meta: JsonRenderMeta): string {
  return `${JSON.stringify(
    {
      version: 1,
      generatedAt: meta.generatedAt,
      summary: {
        findings: defects.length,
        scannedFiles: meta.scannedFiles,
        scannedFunctions: meta.scannedFunctions,
        resourceFunctions: meta.resourceFunctions,
        apiCalls: meta.apiCalls,
        cacheHits: meta.cacheHits,
        baselineFiltered: meta.baselineFiltered,
        incomplete: meta.incomplete,
        incompleteReason: meta.incompleteReason ?? null
      },
      findings: defects
    },
    null,
    2
  )}\n`;
}
