// Filesystem helper utilities (path resolution, file reading, directory traversal)

import { mkdir, readdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Returns the config repo root directory.
 *
 * Uses the `AGENTS_CONFIG_ROOT` environment variable if set,
 * otherwise resolves from `import.meta.url` (two levels up from `dist/utils/`).
 */
export function getAssetsRoot(): string {
  if (process.env.AGENTS_CONFIG_ROOT) {
    return process.env.AGENTS_CONFIG_ROOT;
  }
  // In ESM, __dirname is not available. Derive from import.meta.url.
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = dirname(currentFile);
  // currentDir = <root>/mcp-server/dist/utils  →  go up three levels to reach repo root
  return resolve(currentDir, "..", "..", "..");
}

/** The config repo root, resolved once at import time. */
export const ASSETS_ROOT: string = getAssetsRoot();

/**
 * Ensures a directory exists, creating it recursively if needed.
 */
export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

/**
 * Reads a `skills/` directory and returns an array of skill directory names
 * (only directories that contain a SKILL.md file).
 */
export async function getSkillDirectories(skillsDir: string): Promise<string[]> {
  let entries: string[];
  try {
    entries = await readdir(skillsDir);
  } catch {
    return [];
  }

  const results: string[] = [];

  for (const entry of entries) {
    const entryPath = join(skillsDir, entry);
    const entryStat = await stat(entryPath).catch(() => null);
    if (!entryStat?.isDirectory()) continue;

    const skillMdPath = join(entryPath, "SKILL.md");
    const skillMdStat = await stat(skillMdPath).catch(() => null);
    if (skillMdStat?.isFile()) {
      results.push(entry);
    }
  }

  return results.sort();
}
