export interface CostEstimate {
  inputTokens: number;
  outputTokens: number;
  totalUsd: number;
}

const MODEL_PRICING_PER_1K: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-20250514": { input: 0.003, output: 0.015 },
  "gpt-4.1-mini": { input: 0.0003, output: 0.0012 },
  "gpt-4.1": { input: 0.005, output: 0.015 }
};

function estimateTokensFromChars(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function estimateCost(model: string, prompt: string, response = ""): CostEstimate {
  const pricing = MODEL_PRICING_PER_1K[model] ?? { input: 0.003, output: 0.015 };
  const inputTokens = estimateTokensFromChars(prompt);
  const outputTokens = estimateTokensFromChars(response);

  const totalUsd = (inputTokens / 1000) * pricing.input + (outputTokens / 1000) * pricing.output;

  return {
    inputTokens,
    outputTokens,
    totalUsd
  };
}
