export type Language = "go" | "python" | "typescript" | "java" | "rust" | "c" | "cpp";

export type CallCategory = "resource_acquire" | "resource_release" | "other";

export type ExitPointType = "return" | "throw" | "panic" | "exit" | "break" | "continue";

export interface ScannedCall {
  name: string;
  line: number;
  category: CallCategory;
  variable?: string;
}

export interface ExitPoint {
  type: ExitPointType;
  line: number;
  inErrorHandler: boolean;
}

export interface ErrorHandler {
  type: string;
  startLine: number;
  endLine: number;
}

export interface CFGNode {
  id: string;
  line: number;
  kind: "entry" | "statement" | "branch" | "exit";
}

export interface CFGEdge {
  from: string;
  to: string;
  label?: string;
}

export interface FunctionCFG {
  nodes: CFGNode[];
  edges: CFGEdge[];
}

export interface ScannedFunction {
  id: string;
  file: string;
  function: string;
  startLine: number;
  endLine: number;
  language: Language;
  source: string;
  calls: ScannedCall[];
  exitPoints: ExitPoint[];
  errorHandlers: ErrorHandler[];
  cfg: FunctionCFG;
  hash: string;
}

export interface ScannerSummary {
  files: number;
  functions: number;
  resourceFunctions: number;
  skippedFiles: number;
}

export interface ScanResult {
  functions: ScannedFunction[];
  summary: ScannerSummary;
}
