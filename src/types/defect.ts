import type { ResourceType } from "./model.js";

export type Severity = "info" | "warning" | "critical";
export type Confidence = "low" | "medium" | "high";

export interface Defect {
  id: string;
  fingerprint: string;
  origin: "deterministic_high" | "llm_hybrid";
  severity: Severity;
  confidence: Confidence;
  title: string;
  file: string;
  function: string;
  line: number;
  resource: {
    type: ResourceType;
    acquiredAt: {
      line: number;
      expression: string;
    };
    variable: string;
  };
  missingRelease: {
    pathDescription: string;
    expectedRelease: string;
    exitPoint: {
      line: number;
      type: string;
    };
  };
  trace: {
    acquireLine: number;
    branchLines: number[];
    leakingExitLine: number;
    path: number[];
  };
  suggestion: string;
  autofix: {
    available: boolean;
    safety: "safe" | "risky" | "none";
    patchPreview?: string;
  };
  relatedCwe: string;
}

export interface VerificationResult {
  defects: Defect[];
  filteredFalsePositives: number;
}

export interface BaselineFile {
  version: number;
  generatedAt: string;
  findings: Array<{
    id: string;
    fingerprint: string;
    file: string;
    line: number;
    severity: Severity;
    confidence: Confidence;
  }>;
}
