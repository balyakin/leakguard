import type { Defect } from "../types/defect.js";

const SEVERITY_LEVEL: Record<Defect["severity"], "error" | "warning" | "note"> = {
  critical: "error",
  warning: "warning",
  info: "note"
};

export function renderSarifReport(defects: Defect[]): string {
  const rulesById = new Map<string, {
    id: string;
    shortDescription: { text: string };
    properties: {
      precision: Defect["confidence"];
      tags: string[];
    };
  }>();

  for (const defect of defects) {
    if (rulesById.has(defect.id)) {
      continue;
    }

    rulesById.set(defect.id, {
      id: defect.id,
      shortDescription: { text: defect.title },
      properties: {
        precision: defect.confidence,
        tags: [defect.relatedCwe]
      }
    });
  }

  const sarif = {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "LeakGuard",
            version: "0.1.0",
            rules: [...rulesById.values()]
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
