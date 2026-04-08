import { describe, expect, it } from "vitest";
import { redactSecrets } from "../src/utils/redaction.js";

describe("redaction", () => {
  it("keeps common base64 payloads and UUIDs when there is no secret context", () => {
    const input = [
      "const payload = \"VGhpcyBpcyBhIHRlc3QgcGF5bG9hZA==\";",
      "const requestId = \"123e4567-e89b-12d3-a456-426614174000\";"
    ].join("\n");

    const result = redactSecrets(input);

    expect(result.output).toContain("VGhpcyBpcyBhIHRlc3QgcGF5bG9hZA==");
    expect(result.output).toContain("123e4567-e89b-12d3-a456-426614174000");
    expect(result.replacements).toBe(0);
  });

  it("redacts contextual secrets", () => {
    const input = "const apiKey = \"AbCdEf123456+/AbCdEf123456+/Zz\";";
    const result = redactSecrets(input);

    expect(result.output).toContain("<REDACTED_SECRET>");
    expect(result.replacements).toBeGreaterThan(0);
  });
});
