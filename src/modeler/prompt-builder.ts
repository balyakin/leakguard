import { resolve } from "node:path";
import type { Language, ScannedFunction } from "../types/scan.js";
import { sha256 } from "../utils/hash.js";
import { readTextIfExists } from "../utils/file.js";

const PROMPTS_DIR = resolve(process.cwd(), "prompts");

interface PromptAssets {
  template: string;
  templateVersion: string;
  languageContexts: Partial<Record<Language, string>>;
}

export interface BuiltPrompt {
  prompt: string;
  promptFingerprint: string;
  templateVersion: string;
  languageContextVersion: string;
}

function stableVersion(text: string): string {
  return sha256(text);
}

async function loadTemplate(name: string, fallback: string): Promise<string> {
  return (await readTextIfExists(resolve(PROMPTS_DIR, name))) ?? fallback;
}

async function loadLanguageContext(language: Language): Promise<string> {
  return (await readTextIfExists(resolve(PROMPTS_DIR, `context_${language}.txt`))) ?? "";
}

async function loadPromptAssets(
  templateName: string,
  fallbackTemplate: string,
  languages: Language[]
): Promise<PromptAssets> {
  const template = await loadTemplate(templateName, fallbackTemplate);
  const uniqueLanguages = [...new Set(languages)];
  const languageContexts: Partial<Record<Language, string>> = {};

  for (const language of uniqueLanguages) {
    languageContexts[language] = await loadLanguageContext(language);
  }

  return {
    template,
    templateVersion: stableVersion(template),
    languageContexts
  };
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

function buildPromptVersion(prompt: string, context: string, templateVersion: string): BuiltPrompt {
  return {
    prompt,
    promptFingerprint: stableVersion(prompt),
    templateVersion,
    languageContextVersion: stableVersion(context)
  };
}

export async function loadAnalyzePromptAssets(languages: Language[]): Promise<PromptAssets> {
  return loadPromptAssets(
    "analyze.txt",
    [
      "You are a resource lifecycle analyzer.",
      "Output valid JSON only.",
      "Language: {language}",
      "File: {file_path}",
      "Function name: {function_name}",
      "{source_code}"
    ].join("\n"),
    languages
  );
}

export async function loadBatchPromptAssets(languages: Language[]): Promise<PromptAssets> {
  return loadPromptAssets(
    "analyze_batch.txt",
    [
      "You are a resource lifecycle analyzer.",
      "Analyze every function in this batch.",
      "Return valid JSON only.",
      "Use function_id exactly as provided."
    ].join("\n"),
    languages
  );
}

export async function buildAnalyzePrompt(fn: ScannedFunction, assets?: PromptAssets): Promise<BuiltPrompt> {
  const promptAssets = assets ?? (await loadAnalyzePromptAssets([fn.language]));
  const languageContext = promptAssets.languageContexts[fn.language] ?? "";

  const prompt = promptAssets.template
    .replaceAll("{language}", fn.language)
    .replaceAll("{file_path}", fn.file)
    .replaceAll("{function_name}", fn.function)
    .replaceAll("{source_code}", fn.source)
    .concat(languageContext ? `\n\n${languageContext}` : "");

  return buildPromptVersion(prompt, languageContext, promptAssets.templateVersion);
}

export async function buildAnalyzeBatchPrompt(
  functions: ScannedFunction[],
  assets?: PromptAssets
): Promise<BuiltPrompt> {
  const languages = [...new Set(functions.map((fn) => fn.language))];
  const promptAssets = assets ?? (await loadBatchPromptAssets(languages));
  const joinedContext = languages
    .map((language) => promptAssets.languageContexts[language] ?? "")
    .filter(Boolean)
    .join("\n\n");
  const functionsPayload = functions.map(renderFunctionBlock).join("\n\n");

  const prompt = [promptAssets.template, joinedContext ? `## Language contexts\n${joinedContext}` : "", "## Functions", functionsPayload]
    .filter(Boolean)
    .join("\n\n");

  return buildPromptVersion(prompt, joinedContext, promptAssets.templateVersion);
}
