import { describe, expect, it } from "vitest";
import { buildCacheKey } from "../src/modeler/cache.js";

describe("cache", () => {
  it("distinguishes prompt fingerprints with identical lengths", () => {
    const left = buildCacheKey({
      sourceCode: "fn()",
      promptFingerprint: "a".repeat(64),
      modelerVersion: "0.2.0",
      redactionPolicyVersion: "2:redacted"
    });
    const right = buildCacheKey({
      sourceCode: "fn()",
      promptFingerprint: "b".repeat(64),
      modelerVersion: "0.2.0",
      redactionPolicyVersion: "2:redacted"
    });

    expect(left).not.toBe(right);
  });

  it("separates redacted and raw cache entries", () => {
    const redacted = buildCacheKey({
      sourceCode: "fn()",
      promptFingerprint: "a".repeat(64),
      modelerVersion: "0.2.0",
      redactionPolicyVersion: "2:redacted"
    });
    const raw = buildCacheKey({
      sourceCode: "fn()",
      promptFingerprint: "a".repeat(64),
      modelerVersion: "0.2.0",
      redactionPolicyVersion: "2:raw"
    });

    expect(redacted).not.toBe(raw);
  });
});
