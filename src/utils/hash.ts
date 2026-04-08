import { createHash } from "node:crypto";

export function sha1(value: string): string {
  return createHash("sha1").update(value).digest("hex");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
