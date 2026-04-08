import { cosmiconfig } from "cosmiconfig";
import type { LeakGuardConfig } from "../types/config.js";
import { DEFAULT_CONFIG } from "./default.js";

function deepMerge<T extends object>(base: T, patch: Partial<T>): T {
  const result = { ...base } as Record<string, unknown>;

  for (const [key, value] of Object.entries(patch)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      result[key] &&
      typeof result[key] === "object" &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(result[key] as object, value as object);
      continue;
    }

    if (value !== undefined) {
      result[key] = value;
    }
  }

  return result as T;
}

function toCamelCase(value: string): string {
  return value.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function normalizeKeys<T>(input: T): T {
  if (Array.isArray(input)) {
    return input.map((entry) => normalizeKeys(entry)) as T;
  }

  if (input && typeof input === "object") {
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      normalized[toCamelCase(key)] = normalizeKeys(value);
    }
    return normalized as T;
  }

  return input;
}

function applyEnv(config: LeakGuardConfig): LeakGuardConfig {
  const env = process.env;
  const merged = structuredClone(config);

  if (env.LEAKGUARD_PROVIDER) {
    merged.api.provider = env.LEAKGUARD_PROVIDER as LeakGuardConfig["api"]["provider"];
  }
  if (env.LEAKGUARD_MODEL) {
    merged.api.model = env.LEAKGUARD_MODEL;
  }
  if (env.LEAKGUARD_BASE_REF) {
    merged.scan.baseRef = env.LEAKGUARD_BASE_REF;
  }
  if (env.LEAKGUARD_BASELINE_FILE) {
    merged.scan.baselineFile = env.LEAKGUARD_BASELINE_FILE;
  }
  if (env.LEAKGUARD_REDACT_SECRETS) {
    merged.api.redactSecrets = env.LEAKGUARD_REDACT_SECRETS === "true";
  }

  return merged;
}

export async function loadConfig(): Promise<LeakGuardConfig> {
  const explorer = cosmiconfig("leakguard", {
    searchPlaces: [".leakguard.yml", ".leakguard.yaml", ".leakguard.json", "package.json"]
  });

  const found = await explorer.search(process.cwd());
  const loaded = normalizeKeys((found?.config ?? {}) as Partial<LeakGuardConfig>);
  const merged = deepMerge(DEFAULT_CONFIG, loaded);
  return applyEnv(merged);
}
