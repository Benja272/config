// Skill discovery, metadata parsing, and SKILL.md handling utilities

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import { getSkillDirectories } from "./fs-helpers.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SkillMetadata {
  name: string;
  description: string;
  scope: string[];
  autoInvoke: string[];
}

// ---------------------------------------------------------------------------
// Metadata extraction
// ---------------------------------------------------------------------------

/**
 * Reads a SKILL.md file and extracts its frontmatter metadata via gray-matter.
 *
 * Handles both scalar and array forms for `scope` and `auto_invoke`, as well
 * as missing fields (which default to empty arrays).
 */
export async function extractSkillMetadata(
  skillPath: string,
): Promise<SkillMetadata> {
  const raw = await readFile(skillPath, "utf-8");
  const parsed = matter(raw);
  const data = parsed.data as Record<string, unknown>;

  const name = typeof data.name === "string" ? data.name : "";
  const description = typeof data.description === "string"
    ? data.description.trim()
    : "";

  // metadata is a nested object inside the frontmatter
  const metadata = (data.metadata ?? {}) as Record<string, unknown>;

  const scope = normalizeStringArray(metadata.scope);
  const autoInvoke = normalizeStringArray(metadata.auto_invoke);

  return { name, description, scope, autoInvoke };
}

/**
 * Normalises a value that can be a string, an array of strings, or
 * undefined/null into a string[].
 *
 * Handles:
 *   - `"single string"` -> `["single string"]`
 *   - `["array", "of", "strings"]` -> as-is (trimmed)
 *   - `undefined` / `null` -> `[]`
 */
function normalizeStringArray(value: unknown): string[] {
  if (value == null) return [];

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? [] : [trimmed];
  }

  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === "string" ? v.trim() : String(v).trim()))
      .filter((v) => v !== "");
  }

  return [];
}

// ---------------------------------------------------------------------------
// Skill collection by scope
// ---------------------------------------------------------------------------

/**
 * Finds all `skills/SKILL.md` files in a project, extracts metadata from
 * each, and groups them by scope.
 *
 * Returns a `Map<string, SkillMetadata[]>` where keys are scope names and
 * values are arrays of skill metadata that target that scope.
 */
export async function collectSkillsByScope(
  projectPath: string,
): Promise<Map<string, SkillMetadata[]>> {
  const skillsDir = join(projectPath, "skills");
  const skillDirs = await getSkillDirectories(skillsDir);

  const byScope = new Map<string, SkillMetadata[]>();

  for (const dirName of skillDirs) {
    const skillPath = join(skillsDir, dirName, "SKILL.md");
    const meta = await extractSkillMetadata(skillPath);

    // Skip skills without scope or auto_invoke
    if (meta.scope.length === 0 || meta.autoInvoke.length === 0) continue;

    for (const scope of meta.scope) {
      const existing = byScope.get(scope);
      if (existing) {
        existing.push(meta);
      } else {
        byScope.set(scope, [meta]);
      }
    }
  }

  return byScope;
}

// ---------------------------------------------------------------------------
// Auto-invoke table generation
// ---------------------------------------------------------------------------

/**
 * Generates the markdown table string for an auto-invoke section.
 *
 * Each skill may have multiple `autoInvoke` entries, producing one row per
 * action. Rows are sorted by Action (primary) then Skill name (secondary)
 * using `localeCompare` for deterministic output.
 */
export function generateAutoInvokeTable(skills: SkillMetadata[]): string {
  // Build rows as [action, skillName] tuples
  const rows: [string, string][] = [];

  for (const skill of skills) {
    for (const action of skill.autoInvoke) {
      rows.push([action, skill.name]);
    }
  }

  // Sort by Action (primary), then Skill name (secondary) — deterministic
  rows.sort((a, b) => {
    const actionCmp = a[0].localeCompare(b[0]);
    if (actionCmp !== 0) return actionCmp;
    return a[1].localeCompare(b[1]);
  });

  const lines: string[] = [
    "### Auto-invoke Skills",
    "",
    "When performing these actions, ALWAYS invoke the corresponding skill FIRST:",
    "",
    "| Action | Skill |",
    "|--------|-------|",
  ];

  for (const [action, skillName] of rows) {
    lines.push(`| ${action} | \`${skillName}\` |`);
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// AGENTS.md section replacement
// ---------------------------------------------------------------------------

/**
 * Replaces the `### Auto-invoke Skills` section in an AGENTS.md string with
 * new table content.
 *
 * - If the section exists, replaces everything from `### Auto-invoke Skills`
 *   up to (but not including) the next `---` or `##` heading.
 * - If the section doesn't exist, inserts after the Skills Reference
 *   blockquote (looks for a line starting with `> **Skills Reference**` and
 *   inserts after the blockquote ends).
 *
 * Returns the updated string.
 */
export function updateAutoInvokeSection(
  agentsMdContent: string,
  newTableContent: string,
): string {
  const lines = agentsMdContent.split("\n");

  // Try to find existing "### Auto-invoke Skills" section
  const sectionStart = lines.findIndex((line) =>
    line.trimEnd() === "### Auto-invoke Skills",
  );

  if (sectionStart !== -1) {
    // Find the end of the section: next `---` or `##` heading
    let sectionEnd = lines.length;
    for (let i = sectionStart + 1; i < lines.length; i++) {
      const trimmed = lines[i].trimEnd();
      if (trimmed === "---" || trimmed.startsWith("## ")) {
        sectionEnd = i;
        break;
      }
    }

    // Replace the section
    const before = lines.slice(0, sectionStart);
    const after = lines.slice(sectionEnd);
    return [...before, newTableContent, "", ...after].join("\n");
  }

  // Section doesn't exist — insert after Skills Reference blockquote
  // Look for a line starting with `> **Skills Reference**`
  const blockquoteStart = lines.findIndex((line) =>
    line.startsWith("> **Skills Reference**"),
  );

  if (blockquoteStart !== -1) {
    // Find the end of the blockquote (first line that doesn't start with `>`)
    let blockquoteEnd = blockquoteStart + 1;
    while (blockquoteEnd < lines.length) {
      const line = lines[blockquoteEnd];
      // A blockquote continues as long as lines start with `>`
      // An empty line after > content still counts if the next line is >
      if (!line.startsWith(">") && line.trim() !== "") {
        break;
      }
      // If it's an empty line, check if the next non-empty line starts with >
      if (line.trim() === "") {
        let nextNonEmpty = blockquoteEnd + 1;
        while (nextNonEmpty < lines.length && lines[nextNonEmpty].trim() === "") {
          nextNonEmpty++;
        }
        if (nextNonEmpty >= lines.length || !lines[nextNonEmpty].startsWith(">")) {
          break;
        }
      }
      blockquoteEnd++;
    }

    const before = lines.slice(0, blockquoteEnd);
    const after = lines.slice(blockquoteEnd);
    return [...before, "", newTableContent, "", ...after].join("\n");
  }

  // Fallback: append at the end
  return agentsMdContent + "\n\n" + newTableContent + "\n";
}

// ---------------------------------------------------------------------------
// Scope path resolution
// ---------------------------------------------------------------------------

/**
 * Maps a scope name to the corresponding AGENTS.md file path.
 *
 * - `"root"` -> `{projectPath}/AGENTS.md`
 * - anything else -> `{projectPath}/{scope}/AGENTS.md`
 */
export function resolveScopePath(projectPath: string, scope: string): string {
  if (scope === "root") {
    return join(projectPath, "AGENTS.md");
  }
  return join(projectPath, scope, "AGENTS.md");
}
