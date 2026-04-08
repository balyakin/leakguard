import { Command } from "commander";
import { registerDemoCommand } from "./cli/commands/demo.js";
import { registerExplainCommand } from "./cli/commands/explain.js";
import { registerInitCommand } from "./cli/commands/init.js";
import { registerReportCommand } from "./cli/commands/report.js";
import { registerScanCommand } from "./cli/commands/scan.js";

const program = new Command();

program
  .name("leakguard")
  .description("AI-powered resource lifecycle leak analyzer")
  .version("0.1.0");

registerScanCommand(program);
registerDemoCommand(program);
registerInitCommand(program);
registerExplainCommand(program);
registerReportCommand(program);

program.configureOutput({
  outputError: (text, write) => write(text)
});

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = 2;
});
