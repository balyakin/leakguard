import { describe, expect, it } from "vitest";
import { runScanner } from "../src/scanner/index.js";
import { createLogger } from "../src/utils/logger.js";

describe("scanner", () => {
  it("extracts resource-relevant functions", async () => {
    const result = await runScanner({
      targetPath: "test/fixtures",
      include: ["**/*"],
      exclude: [],
      languages: ["go", "python"],
      maxFunctions: 100,
      minFunctionLines: 2,
      logger: createLogger(false)
    });

    expect(result.summary.files).toBeGreaterThan(0);
    expect(result.summary.functions).toBeGreaterThan(0);
    expect(result.summary.resourceFunctions).toBeGreaterThan(0);
  });
});
