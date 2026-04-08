export async function analyzeWithOllama(baseUrl: string, model: string, prompt: string): Promise<string> {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/generate`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      format: "json"
    })
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed with status ${response.status}`);
  }

  const json = (await response.json()) as { response?: string };
  return json.response ?? "{}";
}
