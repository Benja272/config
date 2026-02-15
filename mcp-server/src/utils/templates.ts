// Template parsing and placeholder resolution utilities

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ASSETS_ROOT } from "./fs-helpers.js";

/**
 * Reads a template file from `{ASSETS_ROOT}/templates/{templateName}`
 * and returns its content as a string.
 */
export async function loadTemplate(templateName: string): Promise<string> {
  const templatePath = join(ASSETS_ROOT, "templates", templateName);
  return readFile(templatePath, "utf-8");
}

/**
 * Replaces `{key}` placeholders in content with the corresponding values
 * from the replacements map.
 *
 * Keys in the replacements object should NOT include braces.
 * For example, `{ "project-name": "my-app" }` replaces `{project-name}` with `my-app`.
 */
export function replacePlaceholders(
  content: string,
  replacements: Record<string, string>,
): string {
  let result = content;
  for (const [key, value] of Object.entries(replacements)) {
    // Replace all occurrences of {key} with the value
    result = result.replaceAll(`{${key}}`, value);
  }
  return result;
}

/**
 * Convenience function: loads a template and applies placeholder replacements.
 */
export async function applyTemplate(
  templateName: string,
  replacements: Record<string, string>,
): Promise<string> {
  const content = await loadTemplate(templateName);
  return replacePlaceholders(content, replacements);
}
