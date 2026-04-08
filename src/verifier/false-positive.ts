import type { Defect } from "../types/defect.js";

function isLikelyIntentionalLeak(defect: Defect): boolean {
  if (defect.resource.type === "memory" && /intentional|leak/i.test(defect.title)) {
    return true;
  }

  if (defect.resource.type === "custom" && defect.confidence === "low") {
    return true;
  }

  return false;
}

export function filterFalsePositives(defects: Defect[]): { kept: Defect[]; filtered: number } {
  const kept: Defect[] = [];
  let filtered = 0;

  for (const defect of defects) {
    if (isLikelyIntentionalLeak(defect)) {
      filtered += 1;
      continue;
    }
    kept.push(defect);
  }

  return { kept, filtered };
}
