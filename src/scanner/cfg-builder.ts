import type { ExitPoint, FunctionCFG, LineBranchContext, ScannedCall } from "../types/scan.js";

interface CfgInputs {
  startLine: number;
  endLine: number;
  calls: ScannedCall[];
  exitPoints: ExitPoint[];
  branchLines: number[];
  branchEdges: Array<{
    fromLine: number;
    toLine: number;
  }>;
  lineContexts: Record<number, LineBranchContext[]>;
}

function lineNodeId(line: number): string {
  return `line_${line}`;
}

function hasBranchConflict(current: LineBranchContext[], next: LineBranchContext[]): boolean {
  const currentByBranch = new Map(current.map((entry) => [entry.branchId, entry.choice]));

  for (const entry of next) {
    const currentChoice = currentByBranch.get(entry.branchId);
    if (currentChoice && currentChoice !== entry.choice) {
      return true;
    }
  }

  return false;
}

function isTerminalExit(exit: ExitPoint | undefined): boolean {
  return Boolean(exit && exit.type !== "fallthrough");
}

export function buildFunctionCfg(inputs: CfgInputs): FunctionCFG {
  const nodes: FunctionCFG["nodes"] = [{ id: "entry", line: inputs.startLine, kind: "entry" }];
  const edges: FunctionCFG["edges"] = [];
  const exitByLine = new Map(inputs.exitPoints.map((exit) => [exit.line, exit]));
  const branchLineSet = new Set(inputs.branchLines);

  for (let line = inputs.startLine; line <= inputs.endLine; line += 1) {
    const exit = exitByLine.get(line);
    nodes.push({
      id: lineNodeId(line),
      line,
      kind: exit ? "exit" : branchLineSet.has(line) ? "branch" : "statement"
    });
  }

  edges.push({ from: "entry", to: lineNodeId(inputs.startLine), label: "next" });

  for (let line = inputs.startLine; line < inputs.endLine; line += 1) {
    const currentExit = exitByLine.get(line);
    if (isTerminalExit(currentExit)) {
      continue;
    }

    const currentContext = inputs.lineContexts[line] ?? [];
    const nextContext = inputs.lineContexts[line + 1] ?? [];

    if (hasBranchConflict(currentContext, nextContext)) {
      continue;
    }

    edges.push({
      from: lineNodeId(line),
      to: lineNodeId(line + 1),
      label: "next"
    });
  }

  for (const edge of inputs.branchEdges) {
    if (edge.fromLine < inputs.startLine || edge.fromLine > inputs.endLine) {
      continue;
    }
    if (edge.toLine < inputs.startLine || edge.toLine > inputs.endLine) {
      continue;
    }
    if (edge.fromLine === edge.toLine) {
      continue;
    }

    edges.push({
      from: lineNodeId(edge.fromLine),
      to: lineNodeId(edge.toLine),
      label: "branch"
    });
  }

  nodes.push({ id: "end", line: inputs.endLine, kind: "exit" });
  const lastExit = exitByLine.get(inputs.endLine);
  if (!isTerminalExit(lastExit)) {
    edges.push({
      from: lineNodeId(inputs.endLine),
      to: "end",
      label: "next"
    });
  }

  return { nodes, edges };
}
