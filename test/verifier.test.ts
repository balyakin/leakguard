import { describe, expect, it } from "vitest";
import type { Language } from "../src/types/scan.js";
import { runModeler } from "../src/modeler/index.js";
import { runScanner } from "../src/scanner/index.js";
import { createLogger } from "../src/utils/logger.js";
import { runVerifier } from "../src/verifier/index.js";

async function scanModelVerify(targetPath: string, languages: Language[]) {
  const scanner = await runScanner({
    targetPath,
    include: ["**/*"],
    exclude: [],
    languages,
    maxFunctions: 100,
    minFunctionLines: 2,
    logger: createLogger(false)
  });

  const modeled = await runModeler(scanner.functions, {
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    noCache: true,
    redactSecrets: true,
    parallel: 2,
    logger: createLogger(false),
    enableLlm: false
  });

  return runVerifier(scanner.functions, modeled.functions);
}

describe("verifier", () => {
  it("produces leak findings for vulnerable fixture", async () => {
    const verified = await scanModelVerify("test/fixtures/go/transaction_leak.go", ["go"]);
    expect(verified.defects.length).toBeGreaterThan(0);
  });

  it("does not report leaks for defer/with correct patterns", async () => {
    const goVerified = await scanModelVerify("test/fixtures/go/defer_correct.go", ["go"]);
    const pythonVerified = await scanModelVerify("test/fixtures/python/with_correct.py", ["python"]);

    expect(goVerified.defects.length).toBe(0);
    expect(pythonVerified.defects.length).toBe(0);
  });

  it("suppresses findings with inline leakguard:ignore", async () => {
    const verified = await scanModelVerify("test/fixtures/go/ignored_leak.go", ["go"]);
    expect(verified.defects.length).toBe(0);
    expect(verified.filteredFalsePositives).toBeGreaterThan(0);
  });

  it("suppresses only the explicitly ignored exit path", async () => {
    const verified = await scanModelVerify("test/fixtures/go/partial_ignored_leak.go", ["go"]);

    expect(verified.defects.length).toBe(1);
    expect(verified.filteredFalsePositives).toBe(1);
  });

  it("downgrades test-file severity to info", async () => {
    const verified = await scanModelVerify("test/fixtures/go/leaky_test.go", ["go"]);
    expect(verified.defects.length).toBeGreaterThan(0);
    expect(verified.defects.every((defect) => defect.severity === "info")).toBe(true);
  });

  it("does not let a release from a different branch hide a leak", async () => {
    const verified = await scanModelVerify("test/fixtures/go/branch_release_mismatch.go", ["go"]);

    expect(verified.defects.length).toBeGreaterThan(0);
    expect(verified.defects[0].missingRelease.exitPoint.type).toBe("return");
    expect(verified.defects[0].trace.branchLines.length).toBeGreaterThan(0);
  });
});
