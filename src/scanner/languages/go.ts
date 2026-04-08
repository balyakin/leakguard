import type { LanguageRule } from "./types.js";

export const GO_RULES: LanguageRule = {
  language: "go",
  extensions: [".go"],
  acquirePatterns: [
    /\bos\.Open(File)?\b/,
    /\bos\.Create(Temp)?\b/,
    /\b(?:sql\.Open|db\.Begin|db\.BeginTx)\b/,
    /\b(?:net\.Dial|net\.Listen|tls\.Dial)\b/,
    /\bhttp\.(?:Get|Post|Do)\b/,
    /\b(?:sync\.(?:Mutex|RWMutex)\.Lock|sync\.RWMutex\.RLock)\b/,
    /\bcontext\.With(?:Cancel|Timeout|Deadline)\b/,
    /\bioutil\.TempFile\b/
  ],
  releasePatterns: [
    /\.Close\b/,
    /\.Unlock\b/,
    /\.RUnlock\b/,
    /\btx\.Commit\b/,
    /\btx\.Rollback\b/,
    /\bcancel\b/,
    /\bos\.Remove\b/
  ]
};
