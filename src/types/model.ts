export type ResourceType =
  | "transaction"
  | "file_handle"
  | "lock"
  | "connection"
  | "memory"
  | "context"
  | "channel"
  | "custom";

export interface ResourceAcquire {
  expression: string;
  line: number;
  variable: string;
}

export interface ExpectedRelease {
  expression: string;
  type: "normal" | "error" | "cleanup";
  description: string;
}

export interface ActualRelease {
  expression: string;
  line: number;
  onPath: string;
  coversErrorPaths: boolean;
}

export interface ExecutionPathModel {
  id: string;
  description: string;
  lines: [number, number];
  resourceReleased: boolean;
  releaseMechanism: "direct_call" | "defer" | "finally" | "with_statement" | "RAII" | "none";
  notes: string;
}

export interface ResourceLifecycle {
  id: string;
  type: ResourceType;
  acquire: ResourceAcquire;
  expectedReleases: ExpectedRelease[];
  actualReleases: ActualRelease[];
  executionPaths: ExecutionPathModel[];
}

export interface ResourceModelSummary {
  totalResources: number;
  totalPaths: number;
  pathsWithMissingRelease: number;
  riskLevel: "none" | "low" | "medium" | "high" | "critical";
}

export interface FunctionResourceModel {
  resources: ResourceLifecycle[];
  summary: ResourceModelSummary;
}

export interface ModeledFunction {
  functionId: string;
  model: FunctionResourceModel;
  origin: "deterministic_high" | "llm_hybrid" | "skipped";
  skippedReason?: string;
  cacheHit: boolean;
}

export interface ModelerResult {
  functions: ModeledFunction[];
  apiCalls: number;
  cacheHits: number;
  totalCostUsd: number;
  incomplete: boolean;
  incompleteReason?: string;
}
