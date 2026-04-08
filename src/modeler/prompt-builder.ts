import { resolve } from "node:path";
import type { ScannedFunction } from "../types/scan.js";
import { readTextIfExists } from "../utils/file.js";

const PROMPTS_DIR = resolve(process.cwd(), "prompts");

export interface BuiltPrompt {
  prompt: string;
  templateVersion: string;
  languageContextVersion: string;
}

function stableVersion(text: string): string {
  return String(text.length);
}

async function loadTemplate(name: string, fallback: string): Promise<string> {
  return (await readTextIfExists(resolve(PROMPTS_DIR, name))) ?? fallback;
}

async function loadLanguageContext(language: string): Promise<string> {
  return (await readTextIfExists(resolve(PROMPTS_DIR, `context_${language}.txt`))) ?? "";
}

function renderFunctionBlock(fn: ScannedFunction): string {
  return [
    `Function ID: ${fn.id}`,
    `Language: ${fn.language}`,
    `File: ${fn.file}`,
    `Function name: ${fn.function}`,
    "```",
    fn.source,
    "```"
  ].join("\n");
}

export async function buildAnalyzePrompt(fn: ScannedFunction): Promise<BuiltPrompt> {
  const template = await loadTemplate(
    "analyze.txt",
    [
      "You are a resource lifecycle analyzer.",
      "Output valid JSON only.",
      "Language: {language}",
      "File: {file_path}",
      "Function name: {function_name}",
      "{source_code}"
    ].join("\n")
  );

  const languageContext = await loadLanguageContext(fn.language);

  const prompt = template
    .replaceAll("{language}", fn.language)
    .replaceAll("{file_path}", fn.file)
    .replaceAll("{function_name}", fn.function)
    .replaceAll("{source_code}", fn.source)
    .concat(languageContext ? `\n\n${languageContext}` : "");

  return {
    prompt,
    templateVersion: stableVersion(template),
    languageContextVersion: stableVersion(languageContext)
  };
}

export async function buildAnalyzeBatchPrompt(functions: ScannedFunction[]): Promise<BuiltPrompt> {
  const template = await loadTemplate(
    "analyze_batch.txt",
    [
      "You are a resource lifecycle analyzer.",
      "Analyze every function in this batch.",
      "Return valid JSON only.",
      "Use function_id exactly as provided."
    ].join("\n")
  );

  const uniqueLanguages = [...new Set(functions.map((fn) => fn.language))];
  const contexts = await Promise.all(uniqueLanguages.map((language) => loadLanguageContext(language)));
  const joinedContext = contexts.filter(Boolean).join("\n\n");
  const functionsPayload = functions.map(renderFunctionBlock).join("\n\n");

  const prompt = [template, joinedContext ? `## Language contexts\n${joinedContext}` : "", "## Functions", functionsPayload]
    .filter(Boolean)
    .join("\n\n");

  return {
    prompt,
    templateVersion: stableVersion(template),
    languageContextVersion: stableVersion(joinedContext)
  };
}
