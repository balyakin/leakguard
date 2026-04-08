import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { sha256 } from "../utils/hash.js";

const CACHE_DIR = resolve(process.cwd(), ".leakguard", "cache");

export interface CacheKeyInput {
  sourceCode: string;
  promptFingerprint: string;
  modelerVersion: string;
  redactionPolicyVersion: string;
}

export function buildCacheKey(input: CacheKeyInput): string {
  return sha256(`${input.sourceCode}|${input.promptFingerprint}|${input.modelerVersion}|${input.redactionPolicyVersion}`);
}

function cachePath(key: string): string {
  return join(CACHE_DIR, `${key}.json`);
}

export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const content = await readFile(cachePath(key), "utf8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

export async function setCache<T>(key: string, value: T): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(cachePath(key), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
