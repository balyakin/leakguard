import type { Confidence, Severity } from "./defect.js";
import type { Language } from "./scan.js";

export type OutputFormat = "terminal" | "json" | "sarif" | "html" | "markdown";
export type ApiProvider = "anthropic" | "openai" | "ollama";

export interface LeakGuardConfig {
  api: {
    provider: ApiProvider;
    keyEnv?: string;
    keychainService?: string;
    key?: string | null;
    model: string;
    baseUrl?: string | null;
    parallel: number;
    costLimit?: number;
    redactSecrets: boolean;
  };
  scan: {
    languages: Language[];
    include: string[];
    exclude: string[];
    changedOnly: boolean;
    baseRef: string;
    baselineFile: string;
    updateBaseline: boolean;
    maxFunctions: number;
    minFunctionLines: number;
  };
  report: {
    format: OutputFormat;
    severity: Severity;
    confidence: Confidence;
    showTrace: boolean;
    includeAutofix: boolean;
  };
  ci: {
    failOn: {
      severity: Severity;
      confidence: Confidence;
    };
    requireComplete: boolean;
    sarifOutput: string;
  };
  resources: {
    custom: Array<{
      name: string;
      acquire: string[];
      release: string[];
      description?: string;
    }>;
  };
}

export interface ScanRunOptions {
  path: string;
  format: OutputFormat;
  output?: string;
  language?: Language;
  severity: Severity;
  confidence: Confidence;
  include?: string;
  exclude?: string;
  changed: boolean;
  baseRef: string;
  baseline: string;
  updateBaseline: boolean;
  maxFunctions: number;
  minFunctionLines?: number;
  noCache: boolean;
  verbose: boolean;
  dryRun: boolean;
  apiProvider: ApiProvider;
  model: string;
  parallel: number;
  costLimit?: number;
  noRedactSecrets: boolean;
  fix: boolean;
  requireComplete: boolean;
  disableLlm?: boolean;
}
