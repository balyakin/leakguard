import type { FunctionCFG } from "../types/scan.js";

export function isPathReachable(cfg: FunctionCFG, fromLine: number, toLine: number): boolean {
  if (toLine < fromLine) {
    return false;
  }

  const hasFrom = cfg.nodes.some((node) => node.line === fromLine || (node.line <= fromLine && node.kind === "entry"));
  const hasTo = cfg.nodes.some((node) => node.line === toLine || (node.line >= toLine && node.kind === "exit"));

  return hasFrom && hasTo;
}
