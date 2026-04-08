import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function runGit(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    cwd: process.cwd(),
    env: process.env
  });
  return stdout.trim();
}

export async function getChangedFiles(baseRef: string): Promise<Set<string>> {
  try {
    const mergeBase = await runGit(["merge-base", "HEAD", baseRef]);
    const diff = await runGit(["diff", "--name-only", `${mergeBase}...HEAD`]);

    if (!diff) {
      return new Set<string>();
    }

    return new Set(
      diff
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
    );
  } catch {
    return new Set<string>();
  }
}
