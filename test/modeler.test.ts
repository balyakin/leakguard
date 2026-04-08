import { describe, expect, it } from "vitest";
import { runModeler } from "../src/modeler/index.js";
import { runScanner } from "../src/scanner/index.js";
import { createLogger } from "../src/utils/logger.js";

describe("modeler", () => {
  it("builds deterministic lifecycle model", async () => {
    const scanner = await runScanner({
      targetPath: "test/fixtures/go",
      include: ["**/*"],
      exclude: [],
      languages: ["go"],
      maxFunctions: 100,
      minFunctionLines: 2,
      logger: createLogger(false)
    });

    const modeled = await runModeler(scanner.functions, {
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      noCache: true,
      redactSecrets: true,
      parallel: 1,
      logger: createLogger(false),
      enableLlm: false
    });

    expect(modeled.functions.length).toBeGreaterThan(0);
    expect(modeled.functions[0].model.resources.length).toBeGreaterThan(0);
  });

  it("does not treat unrelated release call substrings as matching the acquired variable", async () => {
    const scanner = await runScanner({
      targetPath: "test/fixtures/go/substring_noise.go",
      include: ["**/*"],
      exclude: [],
      languages: ["go"],
      maxFunctions: 100,
      minFunctionLines: 2,
      logger: createLogger(false)
    });

    const modeled = await runModeler(scanner.functions, {
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      noCache: true,
      redactSecrets: true,
      parallel: 1,
      logger: createLogger(false),
      enableLlm: false
    });

    const executionPaths = modeled.functions[0].model.resources[0].executionPaths;
    expect(executionPaths.some((path) => !path.resourceReleased)).toBe(true);
  });
});
