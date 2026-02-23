// Project-level .agents-config.json reading and writing utilities

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProjectConfig {
  project_name?: string;
  assistants?: string[];
  license?: string;
  author?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** The filename used for project configuration. */
export const CONFIG_FILENAME = ".agents-config.json";

/** All known assistants, used as the final fallback. */
const ALL_ASSISTANTS = ["claude", "gemini", "codex", "copilot", "cursor"];

/** Valid assistant names for validation. */
const VALID_ASSISTANTS = new Set(ALL_ASSISTANTS);

// ---------------------------------------------------------------------------
// Config loading
// ---------------------------------------------------------------------------

/**
 * Reads `.agents-config.json` from the given project root.
 *
 * Returns `null` if the file does not exist or cannot be parsed.
 * This is intentionally lenient — the config file is an optional
 * enhancement, not a hard requirement.
 */
export async function loadProjectConfig(
  projectPath: string,
): Promise<ProjectConfig | null> {
  const configPath = join(projectPath, CONFIG_FILENAME);
  try {
    const raw = await readFile(configPath, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return validateConfig(parsed);
  } catch {
    return null;
  }
}

/**
 * Validates and normalises a raw JSON object into a ProjectConfig.
 *
 * Unknown keys are silently ignored (forward-compatible).
 * Invalid types for known keys cause those keys to be omitted.
 */
function validateConfig(raw: Record<string, unknown>): ProjectConfig {
  const config: ProjectConfig = {};

  if (typeof raw.project_name === "string") {
    config.project_name = raw.project_name;
  }

  if (Array.isArray(raw.assistants)) {
    const filtered = raw.assistants.filter(
      (a): a is string => typeof a === "string" && VALID_ASSISTANTS.has(a),
    );
    if (filtered.length > 0) {
      config.assistants = filtered;
    }
  }

  if (typeof raw.license === "string") {
    config.license = raw.license;
  }

  if (typeof raw.author === "string") {
    config.author = raw.author;
  }

  return config;
}

// ---------------------------------------------------------------------------
// Config writing
// ---------------------------------------------------------------------------

/**
 * Writes a `.agents-config.json` file to the given project root.
 * Returns the full path of the written file.
 */
export async function writeProjectConfig(
  projectPath: string,
  config: ProjectConfig,
): Promise<string> {
  const configPath = join(projectPath, CONFIG_FILENAME);
  await writeFile(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
  return configPath;
}

// ---------------------------------------------------------------------------
// Resolution helpers
// ---------------------------------------------------------------------------

/**
 * Resolves the assistants list from parameter, config, and default.
 *
 * Priority: explicit parameter > .agents-config.json > all assistants.
 */
export function resolveAssistants(
  paramAssistants: string[] | undefined,
  config: ProjectConfig | null,
): string[] {
  if (paramAssistants !== undefined && paramAssistants.length > 0) {
    return paramAssistants;
  }
  if (config?.assistants && config.assistants.length > 0) {
    return config.assistants;
  }
  return ALL_ASSISTANTS;
}
