import OpenAI from "openai";

export async function analyzeWithOpenAI(apiKey: string, model: string, prompt: string): Promise<string> {
  const client = new OpenAI({ apiKey });
  const response = await client.responses.create({
    model,
    input: prompt,
    max_output_tokens: 4096
  });

  return response.output_text;
}
