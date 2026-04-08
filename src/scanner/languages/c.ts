import type { LanguageRule } from "./types.js";

export const C_RULES: LanguageRule = {
  language: "c",
  extensions: [".c", ".h"],
  acquirePatterns: [
    /\b(?:malloc|calloc|realloc)\b/,
    /\b(?:fopen|open)\b/,
    /\bpthread_mutex_lock\b/,
    /\b(?:socket|accept|connect)\b/
  ],
  releasePatterns: [
    /\bfree\b/,
    /\b(?:fclose|close)\b/,
    /\bpthread_mutex_unlock\b/
  ]
};
