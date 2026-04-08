import type { FunctionCFG } from "../types/scan.js";

export function isPathReachable(cfg: FunctionCFG, fromLine: number, toLine: number): boolean {
  if (toLine < fromLine) {
    return false;
  }

  const fromNode = cfg.nodes.find((node) => node.line === fromLine && node.kind !== "entry");
  const toNode = cfg.nodes.find((node) => node.line === toLine && node.kind !== "entry");

  if (!fromNode || !toNode) {
    return false;
  }

  if (fromNode.id === toNode.id) {
    return true;
  }

  const edgesBySource = new Map<string, string[]>();
  for (const edge of cfg.edges) {
    const entries = edgesBySource.get(edge.from) ?? [];
    entries.push(edge.to);
    edgesBySource.set(edge.from, entries);
  }

  const visited = new Set<string>();
  const queue = [fromNode.id];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) {
      continue;
    }

    if (current === toNode.id) {
      return true;
    }

    visited.add(current);

    const targets = edgesBySource.get(current) ?? [];
    for (const target of targets) {
      if (!visited.has(target)) {
        queue.push(target);
      }
    }
  }

  return false;
}
