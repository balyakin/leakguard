const SECRET_PATTERNS = [
  /(?<k>api[_-]?key|token|secret|password)\s*[:=]\s*["'`][^"'`]{8,}["'`]/gi,
  /(?:sk|rk)-[a-zA-Z0-9_-]{16,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /-----BEGIN [A-Z ]+ PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+ PRIVATE KEY-----/g
];

function shannonEntropy(value: string): number {
  const frequency = new Map<string, number>();
  for (const char of value) {
    frequency.set(char, (frequency.get(char) ?? 0) + 1);
  }

  const length = value.length;
  let entropy = 0;
  for (const count of frequency.values()) {
    const p = count / length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

export function redactSecrets(input: string): { output: string; replacements: number } {
  let output = input;
  let replacements = 0;

  for (const pattern of SECRET_PATTERNS) {
    output = output.replace(pattern, () => {
      replacements += 1;
      return "<REDACTED_SECRET>";
    });
  }

  output = output.replace(/[A-Za-z0-9+/_=-]{24,}/g, (token) => {
    const entropy = shannonEntropy(token);
    if (entropy >= 3.7) {
      replacements += 1;
      return "<REDACTED_SECRET>";
    }
    return token;
  });

  return { output, replacements };
}
