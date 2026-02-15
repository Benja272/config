import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  readFile,
  writeFile,
  readdir,
  stat,
  copyFile,
  access,
} from "node:fs/promises";
import { join, basename } from "node:path";
import matter from "gray-matter";
import { ASSETS_ROOT, ensureDir, getSkillDirectories } from "./utils/fs-helpers.js";
import { applyTemplate } from "./utils/templates.js";
import {
  type SkillMetadata,
  extractSkillMetadata,
  collectSkillsByScope,
  generateAutoInvokeTable,
  updateAutoInvokeSection,
  resolveScopePath,
} from "./utils/skills.js";
import { ASSISTANT_CONFIG_DIRS, syncSkillSymlinks } from "./utils/symlinks.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Recursively copies a directory from `src` to `dest`, creating directories
 * as needed.
 */
async function copyDirRecursive(src: string, dest: string): Promise<string[]> {
  const copied: string[] = [];
  await ensureDir(dest);

  let entries: string[];
  try {
    entries = await readdir(src);
  } catch {
    return copied;
  }

  for (const entry of entries) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    const entryStat = await stat(srcPath).catch(() => null);
    if (!entryStat) continue;

    if (entryStat.isDirectory()) {
      const nested = await copyDirRecursive(srcPath, destPath);
      copied.push(...nested);
    } else if (entryStat.isFile()) {
      await copyFile(srcPath, destPath);
      copied.push(destPath);
    }
  }

  return copied;
}

/**
 * Checks whether a file or directory exists.
 */
async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Mapping from assistant name to the destination file path (relative to project root)
 * where the AGENTS.md content should be copied for that assistant.
 */
const ASSISTANT_FILE_MAP: Record<string, string> = {
  claude: "CLAUDE.md",
  gemini: "GEMINI.md",
  // codex: AGENTS.md is native — no separate file needed
  copilot: ".github/copilot-instructions.md",
  cursor: ".cursorrules",
};

/** Base skills that are always copied into a new project. */
const BASE_SKILLS = ["skill-creator", "skill-sync"];

/**
 * Orchestration guide appended to every setup_project response.
 * The AI reads this and follows it to fill in real content.
 */
const SETUP_ORCHESTRATION_GUIDE = `
---

## Next Steps — Complete the Configuration

The files above are scaffolded with \`{placeholders}\`. Follow these steps to turn them into a real, useful configuration.

### What Was Created and Why

| File | Purpose | How to Customize |
|------|---------|-----------------|
| \`AGENTS.md\` | **Source of truth** for all AI assistants. Contains project overview, skills, conventions, commands. Codex reads this natively. | Replace all \`{placeholders}\` with real project info. |
| \`CLAUDE.md\` | **Claude Code's** project instructions. Read automatically when Claude opens the project. | Add Claude-specific guidance: Task tool usage, subagent definitions, MCP integration. **Should differ from AGENTS.md.** |
| \`GEMINI.md\` | **Gemini CLI's** project instructions. | Add Gemini-specific patterns if needed. |
| \`.cursorrules\` | **Cursor's** project instructions. No skills or subagent support. | Include all critical rules inline. Keep concise — Cursor has token limits. |
| \`.github/copilot-instructions.md\` | **GitHub Copilot's** instructions. No skills support. | Include conventions and patterns inline. |
| \`skills/\` | Modular knowledge packages AI loads on demand. | Create skills for repeatable project-specific patterns using \`create_skill\`. |
| \`.claude/skills/\`, \`.gemini/skills/\`, \`.codex/skills/\` | Symlinks so each assistant discovers skills automatically. | Don't edit — managed by setup and sync tools. |

### Step 1: Interview the User

Ask the user these questions to fill in AGENTS.md with real content:

1. **Tech stack**: What languages, frameworks, and tools does this project use?
2. **Components**: What are the main parts of the project? (e.g., API, UI, shared libs)
3. **Commands**: What are the dev, test, lint, and build commands?
4. **Conventions**: Any naming conventions, code style rules, or patterns to follow?
5. **Project structure**: Is this a monorepo? Microservices? Single app?

Use the answers to replace all \`{placeholders}\` in AGENTS.md.

### Step 2: Create Subfolder AGENTS.md Files (If Needed)

For projects with distinct components (monorepos, multi-service apps), create scoped AGENTS.md files:

- **When**: Each major subfolder has its own tech stack, conventions, or commands
- **Purpose**: Gives subagents focused context when working in that directory
- **How**: Use \`COMPONENT-AGENTS.md.template\` as the base for each component
- **Rule**: Subfolder AGENTS.md overrides root AGENTS.md when guidance conflicts

Example: \`api/AGENTS.md\` for a Python API, \`ui/AGENTS.md\` for a React frontend.

### Step 3: Customize Assistant-Specific Files

Each assistant file should be tailored to that assistant's capabilities — **not identical copies**:

- **CLAUDE.md**: Can reference the Task tool for spawning subagents, MCP tools, skill progressive disclosure, and \`allowed-tools\` directives. Most powerful — use the full feature set.
- **GEMINI.md**: Similar to Claude but adapt for Gemini CLI's capabilities and conventions.
- **.cursorrules**: No skills, no subagents. Include all critical rules and patterns inline. Stay concise.
- **.github/copilot-instructions.md**: No skills. Focus on code conventions, naming patterns, and common operations.

**Approach**: Start from AGENTS.md as the base, then add or remove sections for each assistant's capabilities.

### Step 4: Create Project-Specific Skills

Based on the tech stack detected, consider creating skills for:
- Testing patterns (e.g., \`pytest\`, \`vitest\`, \`jest\`)
- Framework conventions (e.g., \`nextjs\`, \`fastapi\`, \`express\`)
- Project-specific workflows (e.g., \`deployment\`, \`database-migrations\`)

Use the \`create_skill\` tool to scaffold each skill, then fill in real content.

### Step 5: Sync

After creating skills, run \`sync_skills\` to update the Auto-invoke tables in all AGENTS.md files.
`.trim();

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerTools(server: McpServer): void {
  // ──────────────────────────────────────────────────────────────────────
  // Tool 1: list_templates
  // ──────────────────────────────────────────────────────────────────────
  server.tool(
    "list_templates",
    "Lists all available .template files from the config repository",
    {},
    async () => {
      const templatesDir = join(ASSETS_ROOT, "templates");
      let entries: string[];
      try {
        entries = await readdir(templatesDir);
      } catch {
        entries = [];
      }

      const templates = entries
        .filter((e) => e.endsWith(".template"))
        .sort()
        .map((name) => ({
          name,
          path: join(templatesDir, name),
        }));

      return {
        content: [{ type: "text" as const, text: JSON.stringify(templates, null, 2) }],
      };
    },
  );

  // ──────────────────────────────────────────────────────────────────────
  // Tool 2: list_skills
  // ──────────────────────────────────────────────────────────────────────
  server.tool(
    "list_skills",
    "Lists all available skill directories with name, description, and path extracted from SKILL.md frontmatter",
    {},
    async () => {
      const skillsDir = join(ASSETS_ROOT, "templates", "skills");
      const dirs = await getSkillDirectories(skillsDir);

      const skills: { name: string; description: string; path: string }[] = [];

      for (const dir of dirs) {
        const skillMdPath = join(skillsDir, dir, "SKILL.md");
        try {
          const meta = await extractSkillMetadata(skillMdPath);
          skills.push({
            name: meta.name || dir,
            description: meta.description,
            path: join(skillsDir, dir),
          });
        } catch {
          skills.push({
            name: dir,
            description: "",
            path: join(skillsDir, dir),
          });
        }
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify(skills, null, 2) }],
      };
    },
  );

  // ──────────────────────────────────────────────────────────────────────
  // Tool 3: setup_project
  // ──────────────────────────────────────────────────────────────────────
  server.tool(
    "setup_project",
    "Sets up a project with AI agent configuration: creates AGENTS.md, copies base skills, syncs symlinks, and configures assistants",
    {
      project_path: z.string().describe("Absolute path to the project to set up"),
      assistants: z
        .array(z.enum(["claude", "gemini", "codex", "copilot", "cursor"]))
        .optional()
        .default(["claude", "gemini", "codex", "copilot", "cursor"])
        .describe("Which AI assistants to configure"),
      project_name: z
        .string()
        .optional()
        .describe("Project name for template placeholders (defaults to directory basename)"),
      dry_run: z
        .boolean()
        .optional()
        .default(false)
        .describe("If true, returns what would be done without writing files"),
    },
    async (args) => {
      const projectPath = args.project_path;
      const projectName = args.project_name ?? basename(projectPath);
      const assistants = args.assistants;
      const dryRun = args.dry_run;

      const operations: string[] = [];

      // Step 1: Apply AGENTS.md template
      const agentsMdContent = await applyTemplate("AGENTS.md.template", {
        "project-name": projectName,
      });
      const agentsMdPath = join(projectPath, "AGENTS.md");

      if (dryRun) {
        operations.push(`CREATE ${agentsMdPath}`);
      } else {
        await ensureDir(projectPath);
        await writeFile(agentsMdPath, agentsMdContent, "utf-8");
        operations.push(`CREATED ${agentsMdPath}`);
      }

      // Step 2: Copy base skills
      const sourceSkillsDir = join(ASSETS_ROOT, "templates", "skills");
      for (const skillName of BASE_SKILLS) {
        const srcDir = join(sourceSkillsDir, skillName);
        const destDir = join(projectPath, "skills", skillName);

        if (dryRun) {
          operations.push(`COPY ${srcDir} -> ${destDir} (recursive)`);
        } else {
          const copied = await copyDirRecursive(srcDir, destDir);
          for (const f of copied) {
            operations.push(`CREATED ${f}`);
          }
        }
      }

      // Step 3: Sync skill symlinks for symlink-capable assistants
      const symlinkAssistants = assistants.filter((a) => a in ASSISTANT_CONFIG_DIRS);
      if (dryRun) {
        for (const a of symlinkAssistants) {
          const configDir = join(projectPath, ASSISTANT_CONFIG_DIRS[a]);
          operations.push(`SYMLINK skills -> ${configDir} (for ${a})`);
        }
      } else {
        const syncResults = await syncSkillSymlinks(projectPath, symlinkAssistants);
        for (const [assistant, result] of Object.entries(syncResults)) {
          operations.push(`SYMLINK ${result.status.toUpperCase()} ${assistant}: ${ASSISTANT_CONFIG_DIRS[assistant]} -> ${result.target}`);
        }
      }

      // Step 4: Copy AGENTS.md to assistant-specific files
      for (const assistant of assistants) {
        const relPath = ASSISTANT_FILE_MAP[assistant];
        if (!relPath) continue; // codex uses AGENTS.md directly

        const destPath = join(projectPath, relPath);

        if (dryRun) {
          operations.push(`COPY AGENTS.md -> ${destPath} (for ${assistant})`);
        } else {
          await ensureDir(join(destPath, ".."));
          await writeFile(destPath, agentsMdContent, "utf-8");
          operations.push(`CREATED ${destPath}`);
        }
      }

      const prefix = dryRun ? "[DRY RUN] " : "";
      const summary = [
        `${prefix}Project setup ${dryRun ? "plan" : "complete"} for "${projectName}"`,
        `Assistants: ${assistants.join(", ")}`,
        "",
        "Operations:",
        ...operations.map((op) => `  - ${op}`),
      ].join("\n");

      return {
        content: [
          { type: "text" as const, text: summary + "\n\n" + SETUP_ORCHESTRATION_GUIDE },
        ],
      };
    },
  );

  // ──────────────────────────────────────────────────────────────────────
  // Tool 4: create_skill
  // ──────────────────────────────────────────────────────────────────────
  server.tool(
    "create_skill",
    "Creates a new skill in a project from the SKILL.md template, with configured metadata and frontmatter",
    {
      project_path: z.string().describe("Absolute path to the project"),
      skill_name: z.string().describe("Name of the skill (used as directory name and frontmatter name)"),
      description: z.string().describe("Description of the skill"),
      trigger: z.string().describe("When the AI should load this skill"),
      scope: z
        .array(z.string())
        .optional()
        .default(["root"])
        .describe("Scopes for auto-invoke table placement (e.g. ['root', 'src/api'])"),
      auto_invoke: z
        .array(z.string())
        .optional()
        .describe("Actions that trigger auto-invocation of this skill"),
      dry_run: z
        .boolean()
        .optional()
        .default(false)
        .describe("If true, returns what would be created without writing"),
    },
    async (args) => {
      const {
        project_path: projectPath,
        skill_name: skillName,
        description,
        trigger,
        scope,
        auto_invoke: autoInvoke,
        dry_run: dryRun,
      } = args;

      // Step 1: Apply SKILL.md template with placeholder replacements
      const templateContent = await applyTemplate("SKILL.md.template", {
        "skill-name": skillName,
      });

      // Step 2: Parse with gray-matter, modify frontmatter, stringify back
      const parsed = matter(templateContent);
      parsed.data.name = skillName;
      parsed.data.description = `${description}\nTrigger: ${trigger}`;

      if (!parsed.data.metadata || typeof parsed.data.metadata !== "object") {
        parsed.data.metadata = {};
      }
      const metadata = parsed.data.metadata as Record<string, unknown>;
      metadata.scope = scope;
      if (autoInvoke && autoInvoke.length > 0) {
        metadata.auto_invoke = autoInvoke;
      }

      const finalContent = matter.stringify(parsed.content, parsed.data);

      // Step 3: Write SKILL.md
      const skillDir = join(projectPath, "skills", skillName);
      const skillMdPath = join(skillDir, "SKILL.md");
      const assetsDir = join(skillDir, "assets");

      if (dryRun) {
        const operations = [
          `CREATE ${skillMdPath}`,
          `CREATE ${assetsDir}/`,
          `SYMLINK sync for all assistants`,
        ];
        const summary = [
          `[DRY RUN] Skill "${skillName}" creation plan:`,
          "",
          "Operations:",
          ...operations.map((op) => `  - ${op}`),
          "",
          "Frontmatter:",
          `  name: ${skillName}`,
          `  description: ${description}`,
          `  trigger: ${trigger}`,
          `  scope: ${JSON.stringify(scope)}`,
          `  auto_invoke: ${JSON.stringify(autoInvoke ?? [])}`,
        ].join("\n");

        return {
          content: [{ type: "text" as const, text: summary }],
        };
      }

      await ensureDir(skillDir);
      await writeFile(skillMdPath, finalContent, "utf-8");

      // Step 4: Create assets directory
      await ensureDir(assetsDir);

      // Step 5: Sync symlinks for all symlink-capable assistants
      const symlinkAssistants = Object.keys(ASSISTANT_CONFIG_DIRS);
      const syncResults = await syncSkillSymlinks(projectPath, symlinkAssistants);

      const syncSummary: string[] = [];
      for (const [assistant, result] of Object.entries(syncResults)) {
        syncSummary.push(`  ${assistant}: ${result.status} (${ASSISTANT_CONFIG_DIRS[assistant]} -> ${result.target})`);
      }

      const summary = [
        `Skill "${skillName}" created successfully.`,
        "",
        `Files:`,
        `  - ${skillMdPath}`,
        `  - ${assetsDir}/`,
        "",
        "Symlinks:",
        ...syncSummary,
      ].join("\n");

      return {
        content: [{ type: "text" as const, text: summary }],
      };
    },
  );

  // ──────────────────────────────────────────────────────────────────────
  // Tool 5: sync_skills
  // ──────────────────────────────────────────────────────────────────────
  server.tool(
    "sync_skills",
    "Syncs skill metadata into AGENTS.md Auto-invoke tables and updates assistant symlinks",
    {
      project_path: z.string().describe("Absolute path to the project"),
      check_only: z
        .boolean()
        .optional()
        .default(false)
        .describe("If true, only checks if in sync without writing"),
      scope: z
        .string()
        .optional()
        .describe("If provided, only sync this specific scope (e.g. 'root', 'src/api')"),
      dry_run: z
        .boolean()
        .optional()
        .default(false)
        .describe("If true, returns what would change without writing"),
    },
    async (args) => {
      const {
        project_path: projectPath,
        check_only: checkOnly,
        scope: filterScope,
        dry_run: dryRun,
      } = args;

      // Step 1: Collect skills grouped by scope
      const skillsByScope = await collectSkillsByScope(projectPath);

      // Step 2: Filter to specific scope if provided
      const scopesToProcess: [string, SkillMetadata[]][] = [];
      if (filterScope) {
        const skills = skillsByScope.get(filterScope);
        if (skills) {
          scopesToProcess.push([filterScope, skills]);
        }
      } else {
        for (const [scopeName, skills] of skillsByScope) {
          scopesToProcess.push([scopeName, skills]);
        }
      }

      const results: string[] = [];
      let allInSync = true;

      // Step 3: Process each scope
      for (const [scopeName, skills] of scopesToProcess) {
        const agentsMdPath = resolveScopePath(projectPath, scopeName);

        // Read existing AGENTS.md
        let existingContent: string;
        try {
          existingContent = await readFile(agentsMdPath, "utf-8");
        } catch {
          results.push(`SKIP scope "${scopeName}": ${agentsMdPath} not found`);
          continue;
        }

        // Generate new auto-invoke table
        const newTable = generateAutoInvokeTable(skills);

        // Update the section
        const updatedContent = updateAutoInvokeSection(existingContent, newTable);

        if (checkOnly) {
          const inSync = existingContent === updatedContent;
          if (inSync) {
            results.push(`OK scope "${scopeName}": in sync`);
          } else {
            results.push(`DRIFT scope "${scopeName}": ${agentsMdPath} needs update`);
            allInSync = false;
          }
          continue;
        }

        if (dryRun) {
          if (existingContent === updatedContent) {
            results.push(`[DRY RUN] scope "${scopeName}": no changes needed`);
          } else {
            results.push(`[DRY RUN] scope "${scopeName}": would update ${agentsMdPath}`);
          }
          continue;
        }

        // Write the updated content
        if (existingContent !== updatedContent) {
          await writeFile(agentsMdPath, updatedContent, "utf-8");
          results.push(`UPDATED scope "${scopeName}": ${agentsMdPath}`);
        } else {
          results.push(`UNCHANGED scope "${scopeName}": ${agentsMdPath}`);
        }
      }

      // Step 4: Sync symlinks (unless check-only)
      if (!checkOnly) {
        const symlinkAssistants = Object.keys(ASSISTANT_CONFIG_DIRS);

        if (dryRun) {
          results.push(`[DRY RUN] Would sync symlinks for: ${symlinkAssistants.join(", ")}`);
        } else {
          const syncResults = await syncSkillSymlinks(projectPath, symlinkAssistants);
          for (const [assistant, result] of Object.entries(syncResults)) {
            results.push(`SYMLINKS ${assistant}: ${result.status} (${ASSISTANT_CONFIG_DIRS[assistant]} -> ${result.target})`);
          }
        }
      }

      // Build summary
      const prefix = dryRun ? "[DRY RUN] " : checkOnly ? "[CHECK] " : "";
      const statusLine = checkOnly
        ? (allInSync ? "All scopes in sync." : "Drift detected — run sync_skills to fix.")
        : "Sync complete.";

      const summary = [
        `${prefix}${statusLine}`,
        "",
        ...results,
      ].join("\n");

      return {
        content: [{ type: "text" as const, text: summary }],
      };
    },
  );

  // ──────────────────────────────────────────────────────────────────────
  // Tool 6: update_project
  // ──────────────────────────────────────────────────────────────────────
  server.tool(
    "update_project",
    "Checks a project against the latest config templates and skills, reporting differences and optionally applying updates",
    {
      project_path: z.string().describe("Absolute path to the project to check/update"),
      dry_run: z
        .boolean()
        .optional()
        .default(true)
        .describe("If true (default), only reports differences without applying changes"),
    },
    async (args) => {
      const { project_path: projectPath, dry_run: dryRun } = args;
      const report: string[] = [];
      const updates: string[] = [];

      // ── Check available skills vs project skills ────────────────────
      const sourceSkillsDir = join(ASSETS_ROOT, "templates", "skills");
      const availableSkills = await getSkillDirectories(sourceSkillsDir);

      const projectSkillsDir = join(projectPath, "skills");
      const projectSkills = await getSkillDirectories(projectSkillsDir);

      const projectSkillSet = new Set(projectSkills);
      const availableSkillSet = new Set(availableSkills);

      const newSkillsAvailable = availableSkills.filter((s) => !projectSkillSet.has(s));
      const projectOnlySkills = projectSkills.filter((s) => !availableSkillSet.has(s));

      report.push("## Skills");
      report.push(`  Available in config repo: ${availableSkills.join(", ") || "(none)"}`);
      report.push(`  Present in project:       ${projectSkills.join(", ") || "(none)"}`);

      if (newSkillsAvailable.length > 0) {
        report.push(`  New skills available:     ${newSkillsAvailable.join(", ")}`);
      } else {
        report.push(`  New skills available:     (none)`);
      }

      if (projectOnlySkills.length > 0) {
        report.push(`  Project-only skills:      ${projectOnlySkills.join(", ")}`);
      }

      // ── Check assistant configurations ──────────────────────────────
      report.push("");
      report.push("## Assistant Configs");

      const agentsMdPath = join(projectPath, "AGENTS.md");
      const agentsMdExists = await exists(agentsMdPath);
      report.push(`  AGENTS.md:          ${agentsMdExists ? "present" : "MISSING"}`);

      const missingAssistantFiles: string[] = [];

      for (const [assistant, relPath] of Object.entries(ASSISTANT_FILE_MAP)) {
        const filePath = join(projectPath, relPath);
        const fileExists = await exists(filePath);
        report.push(`  ${assistant} (${relPath}): ${fileExists ? "present" : "MISSING"}`);
        if (!fileExists) {
          missingAssistantFiles.push(assistant);
        }
      }

      // ── Check symlinks ──────────────────────────────────────────────
      report.push("");
      report.push("## Symlinks");

      for (const [assistant, configDir] of Object.entries(ASSISTANT_CONFIG_DIRS)) {
        const fullConfigDir = join(projectPath, configDir);
        const configDirExists = await exists(fullConfigDir);
        if (!configDirExists) {
          report.push(`  ${assistant}: ${configDir}/ MISSING`);
        } else {
          let entries: string[];
          try {
            entries = await readdir(fullConfigDir);
          } catch {
            entries = [];
          }
          report.push(`  ${assistant}: ${configDir}/ (${entries.length} entries: ${entries.join(", ") || "empty"})`);
        }
      }

      // ── Apply updates if not dry_run ────────────────────────────────
      if (!dryRun) {
        // Copy new skills that are available but not in the project
        for (const skillName of newSkillsAvailable) {
          const srcDir = join(sourceSkillsDir, skillName);
          const destDir = join(projectSkillsDir, skillName);
          const copied = await copyDirRecursive(srcDir, destDir);
          updates.push(`COPIED skill "${skillName}" (${copied.length} files)`);
        }

        // Create missing assistant files from existing AGENTS.md
        if (agentsMdExists && missingAssistantFiles.length > 0) {
          const agentsMdContent = await readFile(agentsMdPath, "utf-8");
          for (const assistant of missingAssistantFiles) {
            const relPath = ASSISTANT_FILE_MAP[assistant];
            if (!relPath) continue;
            const destPath = join(projectPath, relPath);
            await ensureDir(join(destPath, ".."));
            await writeFile(destPath, agentsMdContent, "utf-8");
            updates.push(`CREATED ${relPath} (for ${assistant})`);
          }
        }

        // Sync symlinks
        const symlinkAssistants = Object.keys(ASSISTANT_CONFIG_DIRS);
        const syncResults = await syncSkillSymlinks(projectPath, symlinkAssistants);
        for (const [assistant, result] of Object.entries(syncResults)) {
          if (result.status !== "unchanged") {
            updates.push(`SYMLINKS ${assistant}: ${result.status} (${ASSISTANT_CONFIG_DIRS[assistant]} -> ${result.target})`);
          }
        }
      }

      // ── Build final output ──────────────────────────────────────────
      const prefix = dryRun ? "[DRY RUN] " : "";
      const sections = [
        `${prefix}Project update report for "${basename(projectPath)}"`,
        "",
        ...report,
      ];

      if (!dryRun && updates.length > 0) {
        sections.push("", "## Updates Applied", ...updates.map((u) => `  - ${u}`));
      } else if (!dryRun && updates.length === 0) {
        sections.push("", "No updates needed — project is up to date.");
      }

      return {
        content: [{ type: "text" as const, text: sections.join("\n") }],
      };
    },
  );
}
