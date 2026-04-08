import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { Command } from "commander";
import type { Language, } from "../../types/scan.js";
import type { ScanRunOptions } from "../../types/config.js";
import { loadConfig } from "../../config/load.js";
import { writeText } from "../../utils/file.js";
import { executeScan } from "./scan.js";

const DEMO_GO = `package main

import "database/sql"

func UpdateUser(db *sql.DB, fail bool) error {
    tx, err := db.Begin()
    if err != nil {
        return err
    }

    if fail {
        return err
    }

    return tx.Commit()
}
`;

const DEMO_PYTHON = `def process_file(path, fail):
    f = open(path, "r")
    if fail:
        return None
    data = f.read()
    f.close()
    return data
`;

function demoSource(language: Language): { fileName: string; source: string } {
  if (language === "python") {
    return { fileName: "demo_leak.py", source: DEMO_PYTHON };
  }
  return { fileName: "demo_leak.go", source: DEMO_GO };
}

export function registerDemoCommand(program: Command): void {
  program
    .command("demo")
    .description("Run local demo scenario without API key")
    .option("--language <language>", "go|python", "go")
    .action(async (options: { language: Language }) => {
      const language: Language = options.language === "python" ? "python" : "go";
      const config = await loadConfig();

      const demoDir = resolve(process.cwd(), ".leakguard", "demo", language);
      await mkdir(demoDir, { recursive: true });

      const payload = demoSource(language);
      await writeText(resolve(demoDir, payload.fileName), payload.source);

      const scanOptions: ScanRunOptions = {
        path: demoDir,
        format: "terminal",
        output: undefined,
        language,
        severity: config.report.severity,
        confidence: config.report.confidence,
        include: "**/*",
        exclude: "",
        changed: false,
        baseRef: config.scan.baseRef,
        baseline: ".leakguard/demo-baseline.json",
        updateBaseline: false,
        maxFunctions: config.scan.maxFunctions,
        noCache: true,
        verbose: false,
        dryRun: false,
        apiProvider: config.api.provider,
        model: config.api.model,
        parallel: 1,
        costLimit: 0,
        noRedactSecrets: false,
        fix: true,
        requireComplete: false,
        disableLlm: true
      };

      const result = await executeScan(scanOptions);
      process.exitCode = result.exitCode;
    });
}
