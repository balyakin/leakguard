import { resolve } from "node:path";
import { Command } from "commander";
import { readTextIfExists, writeText } from "../../utils/file.js";

const DEFAULT_YAML = `# LeakGuard configuration
api:
  provider: anthropic
  key_env: LEAKGUARD_API_KEY
  model: claude-sonnet-4-20250514
  parallel: 5
  cost_limit: 5.0
  redact_secrets: true

scan:
  languages: [go, python, typescript]
  include:
    - "src/**/*"
    - "pkg/**/*"
    - "internal/**/*"
  exclude:
    - "**/*_test.go"
    - "**/*.spec.ts"
    - "**/mocks/**"
  changed_only: false
  base_ref: origin/main
  baseline_file: .leakguard-baseline.json
  update_baseline: false
  max_functions: 500
  min_function_lines: 5

report:
  format: terminal
  severity: warning
  confidence: medium
  show_trace: true
  include_autofix: true

ci:
  fail_on:
    severity: warning
    confidence: medium
  require_complete: true
  sarif_output: leakguard.sarif
`;

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Create a default .leakguard.yml configuration")
    .action(async () => {
      const configPath = resolve(process.cwd(), ".leakguard.yml");
      const existing = await readTextIfExists(configPath);
      if (existing) {
        process.stdout.write(`Config already exists at ${configPath}\n`);
        return;
      }

      await writeText(configPath, DEFAULT_YAML);
      process.stdout.write(`Created ${configPath}\n`);
    });
}
