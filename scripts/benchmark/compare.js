#!/usr/bin/env node

import { readFileSync } from "node:fs";

const currentPath = process.argv[2] ?? ".leakguard/benchmark-scan.json";
const baselinePath = process.argv[3] ?? "docs/benchmarks/latest.json";

const current = JSON.parse(readFileSync(currentPath, "utf8"));
const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));

process.stdout.write(`Current findings: ${current.summary.findings}\n`);
process.stdout.write(`Baseline precision: ${baseline.precision_high_confidence}\n`);
