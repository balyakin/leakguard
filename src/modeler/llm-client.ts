import type { ApiProvider } from "../types/config.js";
import { analyzeWithAnthropic } from "./providers/anthropic.js";
import { analyzeWithOpenAI } from "./providers/openai.js";
import { analyzeWithOllama } from "./providers/ollama.js";

export interface LlmClientOptions {
  provider: ApiProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string | null;
}

export interface LlmClient {
  analyze(prompt: string): Promise<string>;
}

export function createLlmClient(options: LlmClientOptions): LlmClient {
  if (options.provider === "ollama") {
    const baseUrl = options.baseUrl ?? "http://localhost:11434";
    return {
      analyze: (prompt) => analyzeWithOllama(baseUrl, options.model, prompt)
    };
  }

  if (!options.apiKey) {
    throw new Error(`Missing API key for provider ${options.provider}`);
  }

  if (options.provider === "anthropic") {
    return {
      analyze: (prompt) => analyzeWithAnthropic(options.apiKey as string, options.model, prompt)
    };
  }

  return {
    analyze: (prompt) => analyzeWithOpenAI(options.apiKey as string, options.model, prompt)
  };
}
