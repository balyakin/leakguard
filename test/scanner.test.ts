import { describe, expect, it } from "vitest";
import { extractFunctionsFromSource } from "../src/scanner/parser.js";
import { detectFunctionFlowSignals } from "../src/scanner/resource-detector.js";
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

  it("extracts TypeScript arrow functions and function expressions", () => {
    const source = [
      "const handler = async () => {",
      "  return await openFile();",
      "};",
      "",
      "const reader = function() {",
      "  return stream.close();",
      "};"
    ].join("\n");

    const functions = extractFunctionsFromSource("typescript", source, 2);
    const names = functions.map((fn) => fn.name);

    expect(names).toContain("handler");
    expect(names).toContain("reader");
  });

  it("does not classify break or continue as function exits and adds fallthrough when needed", () => {
    const source = [
      "for _, item := range items {",
      "  if item == nil {",
      "    continue",
      "  }",
      "  process(item)",
      "  break",
      "}",
      "cleanup()"
    ].join("\n");

    const flow = detectFunctionFlowSignals("go", source, 10, 17);
    const exitTypes = flow.exitPoints.map((exitPoint) => exitPoint.type);

    expect(exitTypes).not.toContain("break");
    expect(exitTypes).not.toContain("continue");
    expect(exitTypes).toContain("fallthrough");
  });
});
