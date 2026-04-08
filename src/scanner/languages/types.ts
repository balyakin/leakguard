import type { Language } from "../../types/scan.js";

export interface LanguageRule {
  language: Language;
  extensions: string[];
  acquirePatterns: RegExp[];
  releasePatterns: RegExp[];
}
