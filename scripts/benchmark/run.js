#!/usr/bin/env node

import { execSync } from "node:child_process";

const target = process.argv[2] ?? "test/fixtures";
const started = Date.now();

execSync(`node dist/index.js scan ${target} --format json --output .leakguard/benchmark-scan.json`, {
  stdio: "inherit"
});

const elapsed = (Date.now() - started) / 1000;
process.stdout.write(`Benchmark scan completed in ${elapsed.toFixed(2)}s\n`);
