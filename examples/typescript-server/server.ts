import fs from "node:fs";

export function load(path: string, fail: boolean): string | null {
  const handle = fs.openSync(path, "r");
  if (fail) {
    return null;
  }
  fs.closeSync(handle);
  return "ok";
}
