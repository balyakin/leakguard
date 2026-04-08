import { resolve } from "node:path";
import { writeText } from "../utils/file.js";

export async function emitOutput(contents: string, outputPath?: string): Promise<void> {
  if (!outputPath) {
    process.stdout.write(contents);
    return;
  }

  const absolutePath = resolve(process.cwd(), outputPath);
  await writeText(absolutePath, contents);
  process.stderr.write(`Report written to ${absolutePath}\n`);
}
