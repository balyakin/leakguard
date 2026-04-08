import type { LanguageRule } from "./types.js";

export const TYPESCRIPT_RULES: LanguageRule = {
  language: "typescript",
  extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"],
  acquirePatterns: [
    /\bfs\.(?:open|createReadStream|createWriteStream)\b/,
    /\bnew\s+WebSocket\b/,
    /\bnet\.createConnection\b/,
    /\bpool\.(?:connect|getConnection)\b/,
    /\bfetch\b/,
    /\baddEventListener\b/,
    /\bset(?:Interval|Timeout)\b/
  ],
  releasePatterns: [
    /\.(?:close|end|destroy|release)\b/,
    /\bremoveEventListener\b/,
    /\bclear(?:Interval|Timeout)\b/
  ]
};
