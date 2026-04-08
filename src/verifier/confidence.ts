import type { Confidence } from "../types/defect.js";

export function calculateConfidence(args: {
  origin: "deterministic_high" | "llm_hybrid";
  pathVerified: boolean;
  linesVerified: boolean;
  hasPotentialImplicitRelease: boolean;
}): Confidence {
  if (args.origin === "deterministic_high" && args.pathVerified && args.linesVerified && !args.hasPotentialImplicitRelease) {
    return "high";
  }

  if (args.pathVerified && args.linesVerified) {
    return args.hasPotentialImplicitRelease ? "medium" : "high";
  }

  if (args.pathVerified || args.linesVerified) {
    return "medium";
  }

  return "low";
}
