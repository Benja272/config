// Symlink creation and management utilities for AI assistant configs
//
// Uses the same approach as setup.sh: a single directory symlink per assistant.
// e.g. .claude/skills -> ../../skills  (not per-skill symlinks)

import { lstat, readlink, rm, symlink } from "node:fs/promises";
import { join, relative } from "node:path";
import { ensureDir } from "./fs-helpers.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Mapping of assistant name to its skills config path (relative to project root).
 *
 * Only assistants with directory-based skill discovery are included
 * (claude, gemini, codex) — NOT copilot or cursor.
 */
export const ASSISTANT_CONFIG_DIRS: Record<string, string> = {
  claude: ".claude/skills",
  gemini: ".gemini/skills",
  codex: ".codex/skills",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SyncResult {
  created: boolean;
  target: string;
  status: "created" | "unchanged" | "updated";
}

// ---------------------------------------------------------------------------
// Symlink synchronisation
// ---------------------------------------------------------------------------

/**
 * For each assistant in the given list, ensures a single directory symlink
 * from the assistant's config skills path to the project's `skills/` directory.
 *
 * For example, for `claude`:
 *   `.claude/skills` -> `../../skills` (relative symlink)
 *
 * This matches the approach used by `setup.sh`. A single directory symlink
 * is simpler than per-skill symlinks and works identically — the assistant
 * walks the directory and discovers all skills regardless.
 *
 * Returns `Record<string, SyncResult>` keyed by assistant name.
 */
export async function syncSkillSymlinks(
  projectPath: string,
  assistants: string[],
): Promise<Record<string, SyncResult>> {
  const skillsDir = join(projectPath, "skills");
  const results: Record<string, SyncResult> = {};

  for (const assistant of assistants) {
    const configRelPath = ASSISTANT_CONFIG_DIRS[assistant];
    if (!configRelPath) {
      // Unknown assistant or one without directory-based discovery — skip
      continue;
    }

    const linkPath = join(projectPath, configRelPath);
    const parentDir = join(linkPath, "..");
    await ensureDir(parentDir);

    // Compute the relative path from the link location to skills/
    const relativeTarget = relative(parentDir, skillsDir);

    const existingTarget = await readlinkSafe(linkPath);

    if (existingTarget === relativeTarget) {
      // Already correct
      results[assistant] = {
        created: false,
        target: relativeTarget,
        status: "unchanged",
      };
      continue;
    }

    // Remove existing symlink or directory if it's in the way
    if (existingTarget !== null) {
      await rm(linkPath, { recursive: true, force: true });
    } else {
      // Might be a real directory (not a symlink)
      const isLink = await isSymlinkEntry(linkPath);
      if (isLink) {
        await rm(linkPath, { force: true });
      } else {
        // Could be a regular directory — back off, don't destroy user data
        const exists = await lstat(linkPath)
          .then(() => true)
          .catch(() => false);
        if (exists) {
          // Real directory exists at the symlink path — skip to avoid data loss
          results[assistant] = {
            created: false,
            target: relativeTarget,
            status: "unchanged",
          };
          continue;
        }
      }
    }

    await symlink(relativeTarget, linkPath);
    results[assistant] = {
      created: true,
      target: relativeTarget,
      status: existingTarget !== null ? "updated" : "created",
    };
  }

  return results;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Reads the symlink target, returning null if the path is not a symlink
 * or doesn't exist.
 */
async function readlinkSafe(linkPath: string): Promise<string | null> {
  try {
    return await readlink(linkPath);
  } catch {
    return null;
  }
}

/**
 * Checks whether a path is a symlink (using lstat).
 */
async function isSymlinkEntry(entryPath: string): Promise<boolean> {
  try {
    const stats = await lstat(entryPath);
    return stats.isSymbolicLink();
  } catch {
    return false;
  }
}
