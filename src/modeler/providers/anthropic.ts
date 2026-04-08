import Anthropic from "@anthropic-ai/sdk";

export async function analyzeWithAnthropic(apiKey: string, model: string, prompt: string): Promise<string> {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }]
  });

  const textBlocks = response.content.filter((part) => part.type === "text");
  return textBlocks.map((part) => part.text).join("\n");
}
