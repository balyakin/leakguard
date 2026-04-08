import type { FunctionCFG, ScannedCall, ExitPoint } from "../types/scan.js";

interface CfgInputs {
  startLine: number;
  endLine: number;
  calls: ScannedCall[];
  exitPoints: ExitPoint[];
}

export function buildFunctionCfg(inputs: CfgInputs): FunctionCFG {
  const nodes: FunctionCFG["nodes"] = [{ id: "entry", line: inputs.startLine, kind: "entry" }];
  const edges: FunctionCFG["edges"] = [];

  const events = [
    ...inputs.calls.map((call, index) => ({
      id: `call_${index}`,
      line: call.line,
      kind: "statement" as const
    })),
    ...inputs.exitPoints.map((exit, index) => ({
      id: `exit_${index}`,
      line: exit.line,
      kind: "exit" as const
    }))
  ].sort((a, b) => a.line - b.line);

  for (const event of events) {
    nodes.push(event);
  }

  nodes.push({ id: "end", line: inputs.endLine, kind: "exit" });

  for (let i = 0; i < nodes.length - 1; i += 1) {
    edges.push({ from: nodes[i].id, to: nodes[i + 1].id, label: "next" });
  }

  return { nodes, edges };
}
