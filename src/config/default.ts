import type { LeakGuardConfig } from "../types/config.js";

export const DEFAULT_EXCLUDES = [
  "**/node_modules/**",
  "**/.git/**",
  "**/vendor/**",
  "**/dist/**",
  "**/build/**",
  "**/__pycache__/**",
  "**/*.test.*",
  "**/*.spec.*",
  "**/*_test.go",
  "**/*_test.py",
  "**/target/**",
  "**/.venv/**",
  "**/venv/**"
];

export const DEFAULT_CONFIG: LeakGuardConfig = {
  api: {
    provider: "anthropic",
    keyEnv: "LEAKGUARD_API_KEY",
    keychainService: "leakguard",
    key: null,
    model: "claude-sonnet-4-20250514",
    baseUrl: null,
    parallel: 5,
    costLimit: 5,
    redactSecrets: true
  },
  scan: {
    languages: ["go", "python", "typescript", "java", "rust", "c", "cpp"],
    include: ["**/*"],
    exclude: DEFAULT_EXCLUDES,
    changedOnly: false,
    baseRef: "origin/main",
    baselineFile: ".leakguard-baseline.json",
    updateBaseline: false,
    maxFunctions: 500,
    minFunctionLines: 5
  },
  report: {
    format: "terminal",
    severity: "warning",
    confidence: "medium",
    showTrace: true,
    includeAutofix: true
  },
  ci: {
    failOn: {
      severity: "warning",
      confidence: "medium"
    },
    requireComplete: false,
    sarifOutput: "leakguard.sarif"
  },
  resources: {
    custom: []
  }
};
