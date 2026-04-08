import { describe, expect, it } from "vitest";
import type { Defect } from "../src/types/defect.js";
import { renderSarifReport } from "../src/reporter/sarif.js";

function defectWithId(id: string, line: number): Defect {
  return {
    id,
    fingerprint: `${id}-${line}`,
    origin: "deterministic_high",
    severity: "warning",
    confidence: "high",
    title: "resource leak",
    file: "src/example.ts",
    function: "run",
    line,
    resource: {
      type: "file_handle",
      acquiredAt: {
        line: 10,
        expression: "open()"
      },
      variable: "handle"
    },
    missingRelease: {
      pathDescription: "return at line 20",
      expectedRelease: "handle.Close()",
      exitPoint: {
        line,
        type: "return"
      }
    },
    trace: {
      acquireLine: 10,
      branchLines: [],
      leakingExitLine: line,
      path: [10, line]
    },
    suggestion: "close it",
    autofix: {
      available: false,
      safety: "none"
    },
    relatedCwe: "CWE-772"
  };
}

describe("reporter", () => {
  it("deduplicates SARIF rules by ruleId", () => {
    const report = renderSarifReport([defectWithId("LG-1", 20), defectWithId("LG-1", 30)]);
    const parsed = JSON.parse(report) as {
      runs: Array<{
        tool: {
          driver: {
            rules: Array<{ id: string }>;
          };
        };
      }>;
    };

    expect(parsed.runs[0].tool.driver.rules).toHaveLength(1);
    expect(parsed.runs[0].tool.driver.rules[0].id).toBe("LG-1");
  });
});
