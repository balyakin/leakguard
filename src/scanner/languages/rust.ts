import type { LanguageRule } from "./types.js";

export const RUST_RULES: LanguageRule = {
  language: "rust",
  extensions: [".rs"],
  acquirePatterns: [
    /\bFile::(?:open|create)\b/,
    /\b(?:Mutex::lock|RwLock::(?:read|write))\b/,
    /\b(?:TcpStream::connect|TcpListener::bind)\b/,
    /\bunsafe\s*\{\s*(?:alloc|malloc)\b/
  ],
  releasePatterns: [/\bdrop\b/, /\bstd::mem::drop\b/, /\bfree\b/]
};
