import type { LanguageRule } from "./types.js";

export const PYTHON_RULES: LanguageRule = {
  language: "python",
  extensions: [".py"],
  acquirePatterns: [
    /\b(?:open|io\.open)\b/,
    /\b(?:sqlite3\.connect|psycopg2\.connect|pymongo\.MongoClient)\b/,
    /\b(?:threading\.Lock\(\)\.acquire|asyncio\.Lock\(\)\.acquire)\b/,
    /\b(?:socket\.socket|socket\.create_connection)\b/,
    /\b(?:tempfile\.NamedTemporaryFile|tempfile\.mkstemp)\b/,
    /\baiohttp\.ClientSession\b/
  ],
  releasePatterns: [
    /\.close\b/,
    /\.release\b/,
    /\.shutdown\b/,
    /\.commit\b/,
    /\.rollback\b/,
    /\bos\.(?:unlink|remove)\b/
  ]
};
