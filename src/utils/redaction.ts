const SECRET_PATTERNS = [
  /(?<k>api[_-]?key|token|secret|password)\s*[:=]\s*["'`][^"'`]{8,}["'`]/gi,
  /\bBearer\s+[A-Za-z0-9._-]{16,}\b/g,
  /(?:sk|rk)-[a-zA-Z0-9_-]{16,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /-----BEGIN [A-Z ]+ PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+ PRIVATE KEY-----/g
];

const SECRET_CONTEXT_PATTERN = /\b(api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|authorization|bearer|client[_-]?secret)\b/i;

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

function hasMixedCharacterClasses(value: string): boolean {
  let classes = 0;

  if (/[a-z]/.test(value)) {
    classes += 1;
  }
  if (/[A-Z]/.test(value)) {
    classes += 1;
  }
  if (/[0-9]/.test(value)) {
    classes += 1;
  }
  if (/[^A-Za-z0-9]/.test(value)) {
    classes += 1;
  }

  return classes >= 3;
}

function isCommonStructuredValue(value: string): boolean {
  if (/^[a-f0-9]{24,}$/i.test(value)) {
    return true;
  }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    return true;
  }
  if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) {
    return true;
  }
  if (/^[A-Za-z0-9+/]+=*$/.test(value) && value.length % 4 === 0) {
    return true;
  }
  return false;
}

function isLikelyContextualSecret(value: string): boolean {
  if (isCommonStructuredValue(value)) {
    return false;
  }

  if (!hasMixedCharacterClasses(value)) {
    return false;
  }

  return shannonEntropy(value) >= 4.2;
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

  output = output
    .split(/\r?\n/)
    .map((line) => {
      if (!SECRET_CONTEXT_PATTERN.test(line)) {
        return line;
      }

      return line.replace(/(["'`])([A-Za-z0-9+/_=-]{16,})\1/g, (match, quote: string, token: string) => {
        if (isLikelyContextualSecret(token)) {
          replacements += 1;
          return `${quote}<REDACTED_SECRET>${quote}`;
        }
        return match;
      });
    })
    .join("\n");

  output = output.replace(/\bBearer\s+([A-Za-z0-9._-]{16,})\b/g, (match, token: string) => {
    if (isLikelyContextualSecret(token)) {
      replacements += 1;
      return "Bearer <REDACTED_SECRET>";
    }
    return match;
  });

  return { output, replacements };
}
