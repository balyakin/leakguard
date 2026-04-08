import { lstat, readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { glob } from "glob";
import type { Logger } from "../utils/logger.js";
import { sha256 } from "../utils/hash.js";
import type { Language, ScanResult, ScannedFunction } from "../types/scan.js";
import { buildFunctionCfg } from "./cfg-builder.js";
import { analyzeControlFlow } from "./control-flow.js";
import { detectLanguageByExtension, supportedExtensionsFor } from "./languages/index.js";
import { extractFunctionsFromSource } from "./parser.js";
import { detectFunctionFlowSignals, isResourceRelevant } from "./resource-detector.js";

export interface ScannerOptions {
  targetPath: string;
  include: string[];
  exclude: string[];
  languages: Language[];
  forceLanguage?: Language;
  changedFiles?: Set<string>;
  maxFunctions: number;
  minFunctionLines: number;
  logger: Logger;
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}

function pathMatchesChanged(path: string, changedFiles: Set<string>): boolean {
  if (changedFiles.size === 0) {
    return true;
  }

  const normalized = normalizePath(path);
  return changedFiles.has(normalized);
}

async function collectFiles(options: ScannerOptions): Promise<string[]> {
  const absoluteTarget = resolve(options.targetPath);
  const stat = await lstat(absoluteTarget);

  if (stat.isFile()) {
    return [absoluteTarget];
  }

  const include = options.include.length > 0 ? options.include : ["**/*"];
  const files = await glob(include, {
    cwd: absoluteTarget,
    absolute: true,
    nodir: true,
    ignore: options.exclude
  });

  return files;
}

function allowedByLanguage(filePath: string, allowedLanguages: Language[], forceLanguage?: Language): Language | null {
  const detected = detectLanguageByExtension(filePath);
  if (!detected) {
    return null;
  }

  if (forceLanguage && detected !== forceLanguage) {
    return null;
  }

  if (!allowedLanguages.includes(detected)) {
    return null;
  }

  return detected;
}

export async function runScanner(options: ScannerOptions): Promise<ScanResult> {
  const files = await collectFiles(options);
  const allowedExtensions = new Set(supportedExtensionsFor(options.languages));
  const functions: ScannedFunction[] = [];
  let skippedFiles = 0;

  for (const filePath of files) {
    const relativePath = normalizePath(relative(process.cwd(), filePath));
    const extensionAllowed = [...allowedExtensions].some((extension) => filePath.endsWith(extension));
    if (!extensionAllowed) {
      continue;
    }

    if (!pathMatchesChanged(relativePath, options.changedFiles ?? new Set())) {
      continue;
    }

    const language = allowedByLanguage(filePath, options.languages, options.forceLanguage);
    if (!language) {
      skippedFiles += 1;
      continue;
    }

    const source = await readFile(filePath, "utf8");
    const parsed = extractFunctionsFromSource(language, source, options.minFunctionLines);

    for (const fn of parsed) {
      const flow = detectFunctionFlowSignals(language, fn.source, fn.startLine, fn.endLine);
      const controlFlow = analyzeControlFlow(language, fn.source, fn.startLine);
      const cfg = buildFunctionCfg({
        startLine: fn.startLine,
        endLine: fn.endLine,
        calls: flow.calls,
        exitPoints: flow.exitPoints,
        branchLines: controlFlow.branchLines,
        branchEdges: controlFlow.branchEdges,
        lineContexts: controlFlow.lineContexts
      });

      const scannedFunction: ScannedFunction = {
        id: `${relativePath}::${fn.name}::${fn.startLine}-${fn.endLine}`,
        file: relativePath,
        function: fn.name,
        startLine: fn.startLine,
        endLine: fn.endLine,
        language,
        source: fn.source,
        calls: flow.calls,
        exitPoints: flow.exitPoints,
        errorHandlers: flow.errorHandlers,
        branchLines: controlFlow.branchLines,
        lineContexts: controlFlow.lineContexts,
        cfg,
        hash: sha256(fn.source)
      };

      functions.push(scannedFunction);
      if (functions.length >= options.maxFunctions) {
        options.logger.warn("Function limit reached", { maxFunctions: options.maxFunctions });
        break;
      }
    }

    if (functions.length >= options.maxFunctions) {
      break;
    }
  }

  const resourceFunctions = functions.filter((fn) => isResourceRelevant(fn.calls)).length;

  return {
    functions,
    summary: {
      files: files.length,
      functions: functions.length,
      resourceFunctions,
      skippedFiles
    }
  };
}
