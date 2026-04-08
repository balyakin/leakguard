import type { Language, LineBranchContext } from "../types/scan.js";
import { parseSyntaxTree, type SyntaxNode } from "./parser.js";

export interface ControlFlowAnalysis {
  branchLines: number[];
  branchEdges: Array<{
    fromLine: number;
    toLine: number;
  }>;
  lineContexts: Record<number, LineBranchContext[]>;
}

function lineNumber(node: SyntaxNode, startLine: number): number {
  return startLine + node.startPosition.row;
}

function branchRange(node: SyntaxNode, startLine: number): { start: number; end: number } | null {
  if (node.namedChildren.length === 0) {
    const start = lineNumber(node, startLine);
    return {
      start,
      end: startLine + node.endPosition.row
    };
  }

  const firstChild = node.namedChildren[0];
  const lastChild = node.namedChildren[node.namedChildren.length - 1];
  return {
    start: lineNumber(firstChild, startLine),
    end: startLine + lastChild.endPosition.row
  };
}

function firstExecutableLine(node: SyntaxNode, startLine: number): number | null {
  let current: SyntaxNode | null = node;

  while (current && current.namedChildren.length > 0) {
    if (current.type !== "block" && current.type !== "statement_block" && current.type !== "else_clause") {
      break;
    }
    current = current.namedChildren[0] ?? null;
  }

  if (!current) {
    return null;
  }

  return lineNumber(current, startLine);
}

function pushContext(
  lineContexts: Record<number, LineBranchContext[]>,
  start: number,
  end: number,
  context: LineBranchContext
): void {
  for (let line = start; line <= end; line += 1) {
    const entries = lineContexts[line] ?? [];
    entries.push(context);
    lineContexts[line] = entries;
  }
}

function visitBranches(
  node: SyntaxNode,
  startLine: number,
  lineContexts: Record<number, LineBranchContext[]>,
  branchLines: Set<number>,
  branchEdges: Array<{ fromLine: number; toLine: number }>
): void {
  if (node.type === "if_statement") {
    const branchLine = lineNumber(node, startLine);
    const branchId = `if:${branchLine}`;
    const consequence = node.childForFieldName("consequence");
    const alternative = node.childForFieldName("alternative");

    branchLines.add(branchLine);

    if (consequence) {
      const consequenceRange = branchRange(consequence, startLine);
      const consequenceLine = firstExecutableLine(consequence, startLine);

      if (consequenceRange) {
        pushContext(lineContexts, consequenceRange.start, consequenceRange.end, {
          branchId,
          branchLine,
          choice: "then"
        });
      }

      if (consequenceLine !== null && consequenceLine !== branchLine) {
        branchEdges.push({
          fromLine: branchLine,
          toLine: consequenceLine
        });
      }
    }

    if (alternative) {
      const alternativeRange = branchRange(alternative, startLine);
      const alternativeLine = firstExecutableLine(alternative, startLine);
      const alternativeChoice =
        alternative.type === "if_statement"
          ? `else_if:${lineNumber(alternative, startLine)}`
          : "else";

      if (alternativeRange) {
        pushContext(lineContexts, alternativeRange.start, alternativeRange.end, {
          branchId,
          branchLine,
          choice: alternativeChoice
        });
      }

      if (alternativeLine !== null && alternativeLine !== branchLine) {
        branchEdges.push({
          fromLine: branchLine,
          toLine: alternativeLine
        });
      }
    }
  }

  for (const child of node.namedChildren) {
    visitBranches(child, startLine, lineContexts, branchLines, branchEdges);
  }
}

export function analyzeControlFlow(language: Language, source: string, startLine: number): ControlFlowAnalysis {
  const tree = parseSyntaxTree(language, source);
  const lineContexts: Record<number, LineBranchContext[]> = {};
  const branchLines = new Set<number>();
  const branchEdges: Array<{ fromLine: number; toLine: number }> = [];

  visitBranches(tree.rootNode, startLine, lineContexts, branchLines, branchEdges);

  return {
    branchLines: [...branchLines].sort((left, right) => left - right),
    branchEdges,
    lineContexts
  };
}
