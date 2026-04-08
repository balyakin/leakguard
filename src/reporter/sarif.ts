import type { Defect } from "../types/defect.js";

const SEVERITY_LEVEL: Record<Defect["severity"], "error" | "warning" | "note"> = {
  critical: "error",
  warning: "warning",
  info: "note"
};

export function renderSarifReport(defects: Defect[]): string {
  const sarif = {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "LeakGuard",
            version: "0.1.0",
            rules: defects.map((defect) => ({
              id: defect.id,
              shortDescription: { text: defect.title },
              properties: {
                precision: defect.confidence,
                tags: [defect.relatedCwe]
              }
            }))
          }
        },
        results: defects.map((defect) => ({
          ruleId: defect.id,
          level: SEVERITY_LEVEL[defect.severity],
          message: {
            text: `${defect.title}. ${defect.missingRelease.pathDescription}`
          },
          locations: [
            {
              physicalLocation: {
                artifactLocation: {
                  uri: defect.file
                },
                region: {
                  startLine: defect.line
                }
              }
            }
          ]
        }))
      }
    ]
  };

  return `${JSON.stringify(sarif, null, 2)}\n`;
}
