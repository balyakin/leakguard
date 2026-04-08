import type { Language } from "../../types/scan.js";
import type { LanguageRule } from "./types.js";
import { C_RULES } from "./c.js";
import { CPP_RULES } from "./cpp.js";
import { GO_RULES } from "./go.js";
import { JAVA_RULES } from "./java.js";
import { PYTHON_RULES } from "./python.js";
import { RUST_RULES } from "./rust.js";
import { TYPESCRIPT_RULES } from "./typescript.js";

const RULES = [GO_RULES, PYTHON_RULES, TYPESCRIPT_RULES, JAVA_RULES, RUST_RULES, C_RULES, CPP_RULES];

export function getLanguageRules(language: Language): LanguageRule {
  const rule = RULES.find((item) => item.language === language);
  if (!rule) {
    throw new Error(`Unsupported language: ${language}`);
  }
  return rule;
}

export function detectLanguageByExtension(filePath: string): Language | null {
  for (const rule of RULES) {
    if (rule.extensions.some((extension) => filePath.endsWith(extension))) {
      return rule.language;
    }
  }

  return null;
}

export function supportedExtensionsFor(languages: Language[]): string[] {
  return RULES.filter((rule) => languages.includes(rule.language)).flatMap((rule) => rule.extensions);
}
