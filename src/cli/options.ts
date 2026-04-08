import type { Command } from "commander";

export function applyScanOptions(command: Command): Command {
  return command
    .option("-f, --format <format>", "output format: terminal|json|sarif|html|markdown")
    .option("-o, --output <path>", "write report to file")
    .option("-l, --language <language>", "single language: go|python|java|typescript|rust|c|cpp")
    .option("-s, --severity <severity>", "minimum severity: info|warning|critical")
    .option("-c, --confidence <confidence>", "minimum confidence: low|medium|high")
    .option("--include <glob>", "override include glob pattern")
    .option("--exclude <glob>", "override exclude glob pattern")
    .option("--changed", "scan only files changed from merge-base")
    .option("--base-ref <ref>", "base branch for --changed")
    .option("--baseline <path>", "baseline file path")
    .option("--update-baseline", "update baseline file using scan results")
    .option("--max-functions <number>", "max functions to analyze", Number.parseInt)
    .option("--no-cache", "disable model cache")
    .option("-v, --verbose", "verbose logs")
    .option("--dry-run", "show what would be analyzed without API calls")
    .option("--api-provider <provider>", "anthropic|openai|ollama")
    .option("--model <model>", "LLM model")
    .option("-p, --parallel <number>", "parallel modeler workers", Number.parseInt)
    .option("--cost-limit <usd>", "max LLM cost in USD", Number.parseFloat)
    .option("--no-redact-secrets", "disable prompt redaction")
    .option("--fix", "show safe autofix previews")
    .option("--require-complete", "fail if scan ended early due to budget/timeout");
}
