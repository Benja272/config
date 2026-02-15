import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import { ASSETS_ROOT, getSkillDirectories } from "./utils/fs-helpers.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Reads a file relative to the assets root and returns its UTF-8 contents.
 * Throws if the file is missing (the MCP SDK surfaces this as an error to the
 * client).
 */
async function readAsset(relativePath: string): Promise<string> {
  const fullPath = join(ASSETS_ROOT, relativePath);
  return readFile(fullPath, "utf-8");
}

/**
 * Recursively collects all file paths under `dir`, returning paths relative to
 * `baseDir`.
 */
async function listFilesRecursive(
  dir: string,
  baseDir: string,
): Promise<string[]> {
  const results: string[] = [];
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return results;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const entryStat = await stat(fullPath).catch(() => null);
    if (!entryStat) continue;

    if (entryStat.isDirectory()) {
      const nested = await listFilesRecursive(fullPath, baseDir);
      results.push(...nested);
    } else if (entryStat.isFile()) {
      // Path relative to the base directory
      results.push(fullPath.slice(baseDir.length + 1));
    }
  }

  return results.sort();
}

// ---------------------------------------------------------------------------
// Static resource definitions
// ---------------------------------------------------------------------------

interface StaticResource {
  name: string;
  uri: string;
  description: string;
  filePath: string;
}

const STATIC_RESOURCES: StaticResource[] = [
  // Templates
  {
    name: "agents-md-template",
    uri: "template://agents-md",
    description: "Root AGENTS.md template with placeholders for project-wide AI agent configuration",
    filePath: "templates/AGENTS.md.template",
  },
  {
    name: "component-agents-md-template",
    uri: "template://component-agents-md",
    description: "Component-level AGENTS.md template for per-directory AI agent rulesets",
    filePath: "templates/COMPONENT-AGENTS.md.template",
  },
  {
    name: "skill-md-template",
    uri: "template://skill-md",
    description: "SKILL.md template for creating new reusable AI agent skills",
    filePath: "templates/SKILL.md.template",
  },
  {
    name: "docs-style-guide-template",
    uri: "template://docs-style-guide",
    description: "Documentation style guide template with tone, formatting, and inclusive language guidelines",
    filePath: "templates/DOCS-STYLE-GUIDE.md.template",
  },

  // Skills
  {
    name: "skill-creator",
    uri: "skill://skill-creator",
    description: "Skill for creating new AI agent skills following the Agent Skills spec",
    filePath: "templates/skills/skill-creator/SKILL.md",
  },
  {
    name: "skill-sync",
    uri: "skill://skill-sync",
    description: "Skill for syncing skill metadata to AGENTS.md Auto-invoke sections",
    filePath: "templates/skills/skill-sync/SKILL.md",
  },
  {
    name: "skill-typescript",
    uri: "skill://typescript",
    description: "TypeScript strict patterns and best practices skill (const types, flat interfaces, utility types)",
    filePath: "templates/skills/typescript/SKILL.md",
  },

  // Examples
  {
    name: "example-prowler-agents-md",
    uri: "example://prowler/agents-md",
    description: "Real-world example: Prowler root AGENTS.md with skills, subagents, and auto-invoke tables",
    filePath: "examples/prowler/AGENTS.md",
  },
  {
    name: "example-prowler-api-agents-md",
    uri: "example://prowler/api-agents-md",
    description: "Real-world example: Prowler API component AGENTS.md with Django/DRF conventions",
    filePath: "examples/prowler/api-AGENTS.md",
  },

  // Documentation
  {
    name: "doc-concepts",
    uri: "doc://concepts",
    description: "Core concepts guide explaining Subagents vs Skills and when to use each",
    filePath: "docs/concepts.md",
  },
  {
    name: "doc-supported-assistants",
    uri: "doc://supported-assistants",
    description: "Supported AI assistants reference (Claude, Gemini, Codex, Copilot, Cursor) with setup instructions",
    filePath: "docs/supported-assistants.md",
  },
  {
    name: "doc-skill-sync",
    uri: "doc://skill-sync",
    description: "Skill sync mechanism documentation: how auto-invoke tables are generated from skill metadata",
    filePath: "docs/skill-sync.md",
  },
];

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerResources(server: McpServer): void {
  // ── Static resources ────────────────────────────────────────────────
  for (const res of STATIC_RESOURCES) {
    server.resource(
      res.name,
      res.uri,
      { description: res.description, mimeType: "text/markdown" },
      async (uri) => ({
        contents: [
          {
            uri: uri.href,
            mimeType: "text/markdown",
            text: await readAsset(res.filePath),
          },
        ],
      }),
    );
  }

  // ── Dynamic list: templates ─────────────────────────────────────────
  server.resource(
    "template-list",
    "template://list",
    {
      description: "Lists all available .template files in the templates directory",
      mimeType: "application/json",
    },
    async (uri) => {
      const templatesDir = join(ASSETS_ROOT, "templates");
      let entries: string[];
      try {
        entries = await readdir(templatesDir);
      } catch {
        entries = [];
      }

      const templateFiles = entries
        .filter((e) => e.endsWith(".template"))
        .sort()
        .map((name) => ({
          name,
          path: `templates/${name}`,
        }));

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(templateFiles, null, 2),
          },
        ],
      };
    },
  );

  // ── Dynamic list: skills ────────────────────────────────────────────
  server.resource(
    "skill-list",
    "skill://list",
    {
      description:
        "Lists all skill directories with name and description extracted from SKILL.md frontmatter",
      mimeType: "application/json",
    },
    async (uri) => {
      const skillsDir = join(ASSETS_ROOT, "templates", "skills");
      const dirs = await getSkillDirectories(skillsDir);

      const skills: { name: string; description: string; path: string }[] = [];

      for (const dir of dirs) {
        const skillMdPath = join(skillsDir, dir, "SKILL.md");
        try {
          const raw = await readFile(skillMdPath, "utf-8");
          const parsed = matter(raw);
          skills.push({
            name: (parsed.data.name as string) ?? dir,
            description: (parsed.data.description as string)?.trim() ?? "",
            path: `templates/skills/${dir}/SKILL.md`,
          });
        } catch {
          // If we cannot parse frontmatter, fall back to directory name
          skills.push({
            name: dir,
            description: "",
            path: `templates/skills/${dir}/SKILL.md`,
          });
        }
      }

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(skills, null, 2),
          },
        ],
      };
    },
  );

  // ── Dynamic list: examples ──────────────────────────────────────────
  server.resource(
    "example-list",
    "example://list",
    {
      description: "Lists all example files recursively under the examples directory",
      mimeType: "application/json",
    },
    async (uri) => {
      const examplesDir = join(ASSETS_ROOT, "examples");
      const files = await listFilesRecursive(examplesDir, examplesDir);

      const examples = files.map((relativePath) => ({
        name: relativePath,
        path: `examples/${relativePath}`,
      }));

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(examples, null, 2),
          },
        ],
      };
    },
  );
}
