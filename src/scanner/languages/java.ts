import type { LanguageRule } from "./types.js";

export const JAVA_RULES: LanguageRule = {
  language: "java",
  extensions: [".java"],
  acquirePatterns: [
    /\bnew\s+(?:FileInputStream|FileOutputStream|BufferedReader)\b/,
    /\b(?:DriverManager\.getConnection|DataSource\.getConnection)\b/,
    /\bconnection\.(?:prepareStatement|createStatement)\b/,
    /\bnew\s+ReentrantLock\(\)\.lock\b/,
    /\b(?:new\s+Socket|ServerSocket\.accept|Files\.new(?:Input|Output)Stream)\b/
  ],
  releasePatterns: [/\.close\b/, /\.unlock\b/, /\.(?:commit|rollback)\b/]
};
