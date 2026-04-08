import type { LanguageRule } from "./types.js";

export const CPP_RULES: LanguageRule = {
  language: "cpp",
  extensions: [".cpp", ".cc", ".cxx", ".hpp", ".hh", ".hxx"],
  acquirePatterns: [
    /\b(?:malloc|calloc|realloc)\b/,
    /\bnew(?:\[\])?\b/,
    /\b(?:fopen|open)\b/,
    /\bpthread_mutex_lock\b/,
    /\b(?:socket|accept|connect)\b/
  ],
  releasePatterns: [
    /\bfree\b/,
    /\bdelete(?:\[\])?\b/,
    /\b(?:fclose|close)\b/,
    /\bpthread_mutex_unlock\b/
  ]
};
