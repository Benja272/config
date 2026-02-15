# MCP Server Design: `agents-config`

## Problem

Setting up AI agent configurations in a new project currently requires:
1. Clone/copy the config repo
2. Manually copy templates to the target project
3. Replace placeholders by hand
4. Run `setup.sh` locally
5. Manually run `sync.sh` when skills change

This is error-prone and bureaucratic. An MCP server exposes all functionality directly to any MCP-compatible client (Claude Code, Cursor, etc.), eliminating copy-paste workflows entirely.

The shift from `setup.sh` (imperative, human-triggered) to an MCP server (declarative, agent-triggered) solves the biggest friction in agentic coding: **context loading**. Instead of the human remembering to run scripts, the agent can check sync status, fix drift, and discover capabilities on its own.

---

## What Is MCP

Model Context Protocol (MCP) is a standard for exposing **Resources** (read-only data), **Tools** (callable functions), and **Prompts** (reusable prompt templates) to AI assistants. The server runs as a local process that the client connects to via stdio.

**Mental model**: This is a CMS for AI context.
- **Database**: The filesystem (`skills/*.md`, `templates/*.template`)
- **Controller**: The MCP server (Node.js)
- **Views**: The assistant-specific folders (`.claude/`, `.cursorrules`)

---

## Proposed Architecture

```
config/
├── mcp-server/                  # NEW - MCP server package
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts             # Server entry point + stdio transport
│   │   ├── resources.ts         # Resource handlers (templates, skills, examples)
│   │   ├── tools.ts             # Tool handlers (setup, create-skill, sync, update)
│   │   ├── prompts.ts           # Prompt handlers (generate-project-config)
│   │   └── utils/
│   │       ├── templates.ts     # Template loading + placeholder replacement
│   │       ├── skills.ts        # Skill metadata extraction via gray-matter
│   │       ├── symlinks.ts      # Per-skill symlink management
│   │       └── fs-helpers.ts    # File system operations for target projects
│   └── tests/
│       ├── resources.test.ts
│       ├── tools.test.ts
│       ├── integration.test.ts
│       └── utils.test.ts
├── templates/                   # Existing - served as resources
├── examples/                    # Existing - served as resources
├── orchestration/               # Existing - served as prompts
└── ...
```

### Tech Stack

**Runtime**: TypeScript + Node.js

The `@modelcontextprotocol/sdk` is TypeScript-native and has the best ecosystem support. Since we manipulate text files, JSON, and the filesystem, Node.js is the right fit.

**Dependencies**:

| Package | Purpose |
|---------|---------|
| `@modelcontextprotocol/sdk` | MCP server framework |
| `gray-matter` | Frontmatter parsing (used by Gatsby, Jekyll, Next.js) — replaces the fragile `awk` extraction |
| `zod` | Input schema validation (type-safe, converts to JSON Schema via `zod-to-json-schema`) |
| `typescript` | Language |
| `tsx` | Dev runner |

**Dev dependencies**:

| Package | Purpose |
|---------|---------|
| `vitest` | Test framework |
| `zod-to-json-schema` | Generate MCP-compatible JSON schemas from zod definitions |

### Why `gray-matter` Instead of Raw YAML or Awk

The current bash `sync.sh` uses `awk` to extract frontmatter fields — this works but is fragile (whitespace-sensitive, no comment support, complex quoting). A raw YAML parser (`yaml` package) would choke on the markdown body. `gray-matter` cleanly separates frontmatter from content:

```typescript
import matter from 'gray-matter';

const file = matter.read('skills/react-patterns/SKILL.md');
const { scope, auto_invoke } = file.data.metadata;

// Modify and write back without breaking the markdown body
file.data.metadata.auto_invoke.push("New Action");
fs.writeFileSync(filePath, matter.stringify(file.content, file.data));
```

### Assets Root Resolution

The server needs to know where its templates, skills, and examples live. Use `__dirname` relative paths from `mcp-server/dist/index.ts`:

```typescript
const ASSETS_ROOT = path.resolve(__dirname, '..', '..');
// Points to config/ repo root when running from mcp-server/dist/index.js
```

Optionally support an `AGENTS_CONFIG_ROOT` environment variable override for non-standard installations.

---

## Resources (Read-Only)

Resources let the AI fetch templates, skills, and examples on-demand without copying files.

| URI | Description | Source File |
|-----|-------------|-------------|
| `template://agents-md` | Root AGENTS.md template | `templates/AGENTS.md.template` |
| `template://component-agents-md` | Component AGENTS.md template | `templates/COMPONENT-AGENTS.md.template` |
| `template://skill-md` | Skill file template | `templates/SKILL.md.template` |
| `template://docs-style-guide` | Docs style guide template | `templates/DOCS-STYLE-GUIDE.md.template` |
| `skill://skill-creator` | Skill creator skill content | `templates/skills/skill-creator/SKILL.md` |
| `skill://skill-sync` | Skill sync skill content | `templates/skills/skill-sync/SKILL.md` |
| `skill://typescript` | TypeScript patterns skill | `templates/skills/typescript/SKILL.md` |
| `example://prowler/agents-md` | Prowler root AGENTS.md example | `examples/prowler/AGENTS.md` |
| `example://prowler/api-agents-md` | Prowler API AGENTS.md example | `examples/prowler/api-AGENTS.md` |
| `doc://concepts` | Subagents vs Skills guide | `docs/concepts.md` |
| `doc://supported-assistants` | Supported assistants reference | `docs/supported-assistants.md` |
| `doc://skill-sync` | Skill sync documentation | `docs/skill-sync.md` |

### Dynamic Resource Discovery

The server should also support listing resources dynamically:
- `template://list` - List all available templates
- `skill://list` - List all available skills with their descriptions (extracted from frontmatter via `gray-matter`)
- `example://list` - List all available examples

---

## Tools (Callable Functions)

Tools let the AI perform actions in the target project. All mutating tools support a `dry_run` parameter that returns a diff of what would change without writing anything.

### `setup_project`

Initialize AI assistant configuration in a target project directory.

```typescript
{
  name: "setup_project",
  description: "Initialize AI assistant configs in a project. Copies templates to create AGENTS.md, copies base skills, creates per-skill symlinks, and configures assistant-specific files.",
  inputSchema: {
    type: "object",
    properties: {
      project_path: {
        type: "string",
        description: "Absolute path to the target project root"
      },
      assistants: {
        type: "array",
        items: { enum: ["claude", "gemini", "codex", "copilot", "cursor"] },
        description: "Which AI assistants to configure. Defaults to all.",
        default: ["claude", "gemini", "codex", "copilot", "cursor"]
      },
      project_name: {
        type: "string",
        description: "Project name for template placeholders (optional, inferred from directory name)"
      },
      dry_run: {
        type: "boolean",
        description: "If true, return a list of files that would be created/modified without writing anything",
        default: false
      }
    },
    required: ["project_path"]
  }
}
```

**What it does**:
1. **Copies** `AGENTS.md.template` to `{project_path}/AGENTS.md`, replacing `{project-name}` placeholder
2. **Copies** base skills (`skill-creator`, `skill-sync`) into `{project_path}/skills/` — the target project owns these files (decoupled from the config repo)
3. Creates **per-skill symlinks** for each assistant (see [Skill Symlink Registration](#skill-symlink-registration) below)
4. For each assistant:
   - **claude**: Creates per-skill symlinks in `.claude/skills/`, copies AGENTS.md to CLAUDE.md
   - **gemini**: Creates per-skill symlinks in `.gemini/skills/`, copies AGENTS.md to GEMINI.md
   - **codex**: Creates per-skill symlinks in `.codex/skills/`, copies AGENTS.md to AGENTS.md (native)
   - **copilot**: Copies AGENTS.md to `.github/copilot-instructions.md`
   - **cursor**: Copies AGENTS.md to `.cursorrules`

**Key design decision**: Templates and skills are **copied** to the target project, not symlinked from the config repo. The target project should be self-contained — if the MCP server is uninstalled, the project still works. Internal symlinks (`.claude/skills/{name} -> ../../skills/{name}`) are different: they just create views into the project's own `skills/` directory.

### `create_skill`

Scaffold a new skill from the SKILL.md template.

```typescript
{
  name: "create_skill",
  description: "Create a new AI skill in a project from the SKILL.md template.",
  inputSchema: {
    type: "object",
    properties: {
      project_path: {
        type: "string",
        description: "Absolute path to the target project root"
      },
      skill_name: {
        type: "string",
        description: "Skill name (lowercase, hyphens). E.g.: 'react-patterns', 'api-auth'"
      },
      description: {
        type: "string",
        description: "One-line description of what this skill does"
      },
      trigger: {
        type: "string",
        description: "When the AI should load this skill"
      },
      scope: {
        type: "array",
        items: { type: "string" },
        description: "Which AGENTS.md files this skill's auto-invoke should appear in. E.g.: ['root'], ['ui', 'api']",
        default: ["root"]
      },
      auto_invoke: {
        type: "array",
        items: { type: "string" },
        description: "Actions that trigger this skill. E.g.: ['Creating React components', 'Modifying UI state']"
      },
      dry_run: {
        type: "boolean",
        description: "If true, return the generated SKILL.md content without writing files",
        default: false
      }
    },
    required: ["project_path", "skill_name", "description", "trigger"]
  }
}
```

**What it does**:
1. Creates `{project_path}/skills/{skill_name}/SKILL.md` from template
2. Fills in frontmatter using `gray-matter` (name, description, trigger, scope, auto_invoke)
3. Creates empty `assets/` directory
4. Registers the skill with each configured assistant by creating per-skill symlinks (see [Skill Symlink Registration](#skill-symlink-registration))
5. Returns the created file path and a reminder to run sync

### `sync_skills`

Sync skill metadata to AGENTS.md auto-invoke tables (port of `sync.sh`).

```typescript
{
  name: "sync_skills",
  description: "Sync skill metadata to AGENTS.md auto-invoke tables. Reads all skills/*/SKILL.md files, extracts scope and auto_invoke metadata, and updates the Auto-invoke Skills section in each AGENTS.md. Also syncs per-skill symlinks and cleans up orphans.",
  inputSchema: {
    type: "object",
    properties: {
      project_path: {
        type: "string",
        description: "Absolute path to the target project root"
      },
      check_only: {
        type: "boolean",
        description: "If true, only check if files are in sync (returns status without modifying files)",
        default: false
      },
      scope: {
        type: "string",
        description: "Only sync a specific scope (e.g., 'root', 'ui', 'api'). If omitted, syncs all."
      },
      dry_run: {
        type: "boolean",
        description: "If true, return a diff of what would change without writing files",
        default: false
      }
    },
    required: ["project_path"]
  }
}
```

**What it does** (TypeScript port of the bash `sync.sh`):
1. Finds all `skills/*/SKILL.md` files in the project
2. Extracts YAML frontmatter via `gray-matter`: `metadata.scope` and `metadata.auto_invoke`
3. Groups skills by scope
4. For each scope, generates the auto-invoke markdown table (sorted alphabetically by action then skill)
5. Updates the `### Auto-invoke Skills` section in the corresponding AGENTS.md
6. Syncs per-skill symlinks for all configured assistants (see [Skill Symlink Registration](#skill-symlink-registration))
7. Cleans up orphaned symlinks for skills that were removed
8. Returns a summary of changes made (or drift detected if `check_only`)

### `update_project`

Check for and apply updates to a previously set up project.

```typescript
{
  name: "update_project",
  description: "Check if a project's agent configuration is outdated compared to the latest templates and apply updates. Compares template versions and reports what can be updated.",
  inputSchema: {
    type: "object",
    properties: {
      project_path: {
        type: "string",
        description: "Absolute path to the target project root"
      },
      dry_run: {
        type: "boolean",
        description: "If true (default), only report what would change. Set to false to apply updates.",
        default: true
      }
    },
    required: ["project_path"]
  }
}
```

**What it does**:
1. Reads the project's existing `AGENTS.md`, `skills/`, and assistant configs
2. Compares against the latest templates in the config repo
3. Reports differences: new skills available, template structure changes, missing assistant configs
4. When `dry_run: false`, applies updates while preserving project-specific customizations (merges, not overwrites)

### `list_templates`

```typescript
{
  name: "list_templates",
  description: "List all available templates with their descriptions and placeholder documentation.",
  inputSchema: {
    type: "object",
    properties: {},
    required: []
  }
}
```

### `list_skills`

```typescript
{
  name: "list_skills",
  description: "List all available reusable skills with their names, descriptions, and triggers (extracted from frontmatter via gray-matter).",
  inputSchema: {
    type: "object",
    properties: {},
    required: []
  }
}
```

---

## Skill Symlink Registration

This is the critical mechanism that makes skills discoverable by each AI assistant. Each assistant has its own config directory (`.claude/`, `.gemini/`, `.codex/`) and discovers skills by looking for `SKILL.md` files inside its `skills/` subdirectory.

### How It Works

For every skill directory in `skills/`, the server creates a **per-skill symlink** inside each assistant's config directory, pointing back to the canonical `skills/{name}/` folder:

```
project/
├── skills/                          # Canonical skill source (single source of truth)
│   ├── react-patterns/
│   │   └── SKILL.md
│   ├── api-auth/
│   │   └── SKILL.md
│   └── skill-sync/
│       ├── SKILL.md
│       └── assets/
│           └── sync.sh
│
├── .claude/skills/                  # Claude Code reads skills from here
│   ├── react-patterns -> ../../skills/react-patterns
│   ├── api-auth -> ../../skills/api-auth
│   └── skill-sync -> ../../skills/skill-sync
│
├── .gemini/skills/                  # Gemini CLI reads skills from here
│   ├── react-patterns -> ../../skills/react-patterns
│   ├── api-auth -> ../../skills/api-auth
│   └── skill-sync -> ../../skills/skill-sync
│
└── .codex/skills/                   # Codex reads skills from here
    ├── react-patterns -> ../../skills/react-patterns
    ├── api-auth -> ../../skills/api-auth
    └── skill-sync -> ../../skills/skill-sync
```

### Two Levels of Symlinks (Important Distinction)

1. **Config repo → target project**: **COPY** (not symlink). Templates and base skills are copied into the target project so it's self-contained. If the MCP server is uninstalled, the project still works.
2. **Within target project** (`.claude/skills/{name} → ../../skills/{name}`): **SYMLINK**. These are views into the project's own `skills/` directory. The `skills/` dir is the single source of truth; the assistant config dirs are just discovery points.

### Why Per-Skill Symlinks (Not a Single Directory Symlink)

The working `sync.sh` script uses per-skill symlinks (`../../skills/{name}`) rather than a single symlink to the whole `skills/` directory. This is important because:

1. **Claude Code discovers each skill as a `/slash-command`** — it walks `.claude/skills/` looking for directories containing `SKILL.md`
2. **Granular control** — you can exclude specific skills from an assistant by not creating its symlink
3. **Orphan cleanup** — when a skill is deleted from `skills/`, the sync can detect and remove dangling symlinks from `.claude/skills/`

### Symlink Sync Logic (Ported from sync.sh)

The TypeScript implementation in `mcp-server/src/utils/symlinks.ts` must replicate this logic:

```typescript
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

interface SyncResult {
  created: string[];
  removed: string[];
  unchanged: string[];
}

async function syncSkillSymlinks(
  projectPath: string,
  assistants: string[]
): Promise<Record<string, SyncResult>> {
  const skillsDir = path.join(projectPath, "skills");
  const skillDirs = await getSkillDirectories(skillsDir);

  const assistantConfigDirs: Record<string, string> = {
    claude: ".claude/skills",
    gemini: ".gemini/skills",
    codex: ".codex/skills",
  };

  const results: Record<string, SyncResult> = {};

  for (const [assistant, configRelPath] of Object.entries(assistantConfigDirs)) {
    if (!assistants.includes(assistant)) continue;

    const configDir = path.join(projectPath, configRelPath);
    await fs.mkdir(configDir, { recursive: true });

    const result: SyncResult = { created: [], removed: [], unchanged: [] };

    // Create/update symlinks for each skill
    for (const skillName of skillDirs) {
      const linkPath = path.join(configDir, skillName);
      const targetPath = path.relative(configDir, path.join(skillsDir, skillName));

      try {
        const currentTarget = await fs.readlink(linkPath);
        if (currentTarget === targetPath) {
          result.unchanged.push(skillName);
          continue;
        }
        await fs.rm(linkPath, { recursive: true });
      } catch {
        // Link doesn't exist yet — that's fine
      }

      await fs.symlink(targetPath, linkPath);
      result.created.push(skillName);
    }

    // Clean up orphaned symlinks (skill was deleted from skills/)
    const existingEntries = await fs.readdir(configDir);
    for (const entry of existingEntries) {
      const entryPath = path.join(configDir, entry);
      const stat = await fs.lstat(entryPath);
      if (stat.isSymbolicLink()) {
        const resolvedTarget = path.resolve(configDir, await fs.readlink(entryPath));
        try {
          await fs.access(resolvedTarget);
        } catch {
          await fs.rm(entryPath);
          result.removed.push(entry);
        }
      }
    }

    results[assistant] = result;
  }

  return results;
}
```

### When Symlinks Are Synced

Symlinks are synced in **four** MCP tools:
- **`setup_project`** — initial creation for all configured assistants
- **`create_skill`** — immediately registers the new skill with all assistants
- **`sync_skills`** — full reconciliation (creates missing, removes orphaned)
- **`update_project`** — reconciles symlinks when updating an existing project

### Copilot and Cursor

Copilot and Cursor don't have a `skills/` discovery mechanism. They rely solely on their config files (`.github/copilot-instructions.md` and `.cursorrules`), which are flat copies of AGENTS.md. No symlinks needed for these.

---

## Prompts (Reusable Prompt Templates)

Prompts let the AI invoke the multi-phase orchestration workflow.

### `generate-project-config`

```typescript
{
  name: "generate-project-config",
  description: "Multi-phase orchestration prompt for generating comprehensive AI agent configs for a project. Guides the AI through: project analysis, root AGENTS.md generation, component configs, optional skill creation, validation, and setup.",
  arguments: [
    {
      name: "project_path",
      description: "Path to the project to configure",
      required: true
    },
    {
      name: "focus",
      description: "Optional focus area (e.g., 'API component', 'testing patterns')",
      required: false
    },
    {
      name: "skip_phases",
      description: "Comma-separated phases to skip (e.g., '4,6' to skip skill generation and setup)",
      required: false
    }
  ]
}
```

This returns the content from `orchestration/generate-project-config.md` with the arguments interpolated.

---

## Deployment Model (The Chicken-and-Egg Problem)

A user wants to set up a new project but doesn't have the config repo cloned yet. The MCP server runs locally and needs access to templates.

**Solution**: The server is designed to be run from a single "central" config repo clone on the user's machine, and it manages all their projects from there.

### Installation

```bash
# Clone once (this is your "central" config repo)
git clone https://github.com/your-org/config.git ~/agents-config
cd ~/agents-config/mcp-server
npm install && npm run build
```

### Register with Claude Code

Add to `~/.claude.json` or project `.mcp.json`:

```json
{
  "mcpServers": {
    "agents-config": {
      "command": "node",
      "args": ["/home/user/agents-config/mcp-server/dist/index.js"]
    }
  }
}
```

Now every Claude Code session has access to `setup_project`, `create_skill`, `sync_skills`, etc. — regardless of which project directory you're in.

### Future: npx Distribution

Eventually, publish to npm for zero-clone usage:

```json
{
  "mcpServers": {
    "agents-config": {
      "command": "npx",
      "args": ["-y", "agents-config-server"]
    }
  }
}
```

---

## Changes Required to Existing Code

### Files to Update

1. **`templates/skills/skill-sync/assets/sync.sh`** (and the working version provided)
   - The core sync logic (YAML extraction, table generation, section replacement) gets ported to TypeScript in `mcp-server/src/utils/skills.ts`
   - The bash version continues to work standalone; the MCP server provides an alternative interface
   - The `.claude/skills/` symlink sync gets ported to `mcp-server/src/utils/symlinks.ts`

2. **`templates/skills/skill-creator/SKILL.md`**
   - Update the "After Creating a Skill" section to mention both `sync.sh` and the MCP `sync_skills` tool as options
   - Update the checklist to mention MCP as an alternative workflow

3. **`templates/skills/skill-sync/SKILL.md`**
   - Add MCP tool usage as an alternative to running `sync.sh` directly
   - Add a "Usage via MCP" section:
     ```
     ## Usage via MCP
     If the agents-config MCP server is connected, use the `sync_skills` tool instead of running the script directly.
     ```

4. **`setup.sh`**
   - No functional changes needed (it still works standalone)
   - The MCP `setup_project` tool is a parallel path, not a replacement

5. **`README.md`**
   - Add an "MCP Server" section explaining the alternative workflow
   - Add installation/connection instructions

6. **`CLAUDE.md`**
   - Add MCP server development commands (build, test, dev)

7. **`Makefile`**
   - Add targets for the MCP server:
     ```makefile
     mcp-build:
         cd mcp-server && npm run build

     mcp-dev:
         cd mcp-server && npm run dev

     mcp-test:
         cd mcp-server && npm test
     ```

8. **`.agents/AGENTS.md`**
   - Add the MCP server as a component in the Project Overview table
   - Add relevant auto-invoke entries for TypeScript development in the MCP server

### New Files

All new files live under `mcp-server/` — no existing files are moved or deleted.

### Scope Mapping

The `sync.sh` scope-to-path mapping is currently hardcoded for the Prowler project structure:

```bash
# Current (hardcoded)
case "$scope" in
    root)       echo "$REPO_ROOT/AGENTS.md" ;;
    ui)         echo "$REPO_ROOT/ui/AGENTS.md" ;;
    api)        echo "$REPO_ROOT/api/AGENTS.md" ;;
    sdk)        echo "$REPO_ROOT/prowler/AGENTS.md" ;;
    mcp_server) echo "$REPO_ROOT/mcp_server/AGENTS.md" ;;
esac
```

The MCP server uses **convention-based with auto-discovery fallback**:
- `root` → `AGENTS.md` (always)
- Any other scope → `{scope}/AGENTS.md`
- If a scope directory doesn't exist, warn and skip

---

## Implementation Plan

### Phase 1: Project Setup
1. Initialize `mcp-server/` with `package.json`, `tsconfig.json`
2. Dependencies: `@modelcontextprotocol/sdk`, `gray-matter`, `zod`, `zod-to-json-schema`, `typescript`, `tsx`
3. Dev dependencies: `vitest`

### Phase 2: Utils (Core Logic)
1. Frontmatter extraction via `gray-matter` (replaces awk)
2. Auto-invoke table generation (markdown string builder)
3. AGENTS.md section replacement (find `### Auto-invoke Skills`, replace to next `---` or `##`)
4. Template placeholder replacement utility
5. Per-skill symlink management (`symlinks.ts`)
6. File system helpers (read templates, write to target projects)

### Phase 3: Resources
1. Implement template resources (read from `templates/`)
2. Implement skill resources (read from `templates/skills/`)
3. Implement example resources (read from `examples/`)
4. Implement doc resources (read from `docs/`)
5. Implement list endpoints for dynamic discovery

### Phase 4: Tools
1. Implement `list_templates` and `list_skills` (simplest, good for validation)
2. Implement `create_skill`
3. Implement `sync_skills` (most complex — full port of sync.sh logic + symlinks)
4. Implement `setup_project`
5. Implement `update_project`

### Phase 5: Prompts
1. Implement `generate-project-config` prompt
2. Wire up argument interpolation

### Phase 6: Testing
1. Unit tests for frontmatter extraction via `gray-matter` (port sync_test.sh assertions)
2. Unit tests for table generation
3. Unit tests for AGENTS.md section replacement
4. Unit tests for symlink management
5. Integration tests for each tool (using temp directories)
6. Resource listing tests
7. Bash vs TypeScript parity regression tests

---

## How to Test

### Prerequisites

```bash
cd mcp-server
npm install
npm run build
```

### Unit Tests

```bash
# Run all tests
cd mcp-server && npm test

# Run specific test file
cd mcp-server && npx vitest run tests/utils.test.ts

# Watch mode during development
cd mcp-server && npx vitest
```

### Manual Testing with MCP Inspector

The MCP Inspector is an interactive debugging tool for MCP servers:

```bash
# Install and run the inspector
cd mcp-server && npx @modelcontextprotocol/inspector node dist/index.js
```

This opens a web UI where you can:
- Browse all registered resources, tools, and prompts
- Call tools with custom inputs and see results
- Fetch resources and inspect content
- Test prompts with different arguments

### Manual Testing with Claude Code

Add the server to your Claude Code MCP config (`~/.claude.json` or project-level `.mcp.json`):

```json
{
  "mcpServers": {
    "agents-config": {
      "command": "node",
      "args": ["/absolute/path/to/config/mcp-server/dist/index.js"]
    }
  }
}
```

Then in Claude Code:
```
# List available resources
> Use the agents-config MCP to list available templates

# Setup a project
> Use the agents-config MCP to setup AI configs in /path/to/my-project for claude and cursor

# Create a skill
> Use agents-config to create a "react-patterns" skill in /path/to/my-project

# Sync skills
> Use agents-config to sync skills in /path/to/my-project

# Check for updates
> Use agents-config to check if /path/to/my-project has outdated configs
```

### Integration Test Script

Create `mcp-server/tests/integration.test.ts` that:

```typescript
// 1. Creates a temp directory as a mock project
// 2. Calls setup_project tool → verifies files created (AGENTS.md, skills/, CLAUDE.md, etc.)
// 3. Verifies skills are COPIED (not symlinked from config repo)
// 4. Verifies per-skill symlinks exist:
//    - .claude/skills/skill-creator -> ../../skills/skill-creator
//    - .claude/skills/skill-sync -> ../../skills/skill-sync
//    - Same for .gemini/skills/ and .codex/skills/
// 5. Verifies symlinks resolve to valid targets (not dangling)
// 6. Calls setup_project with dry_run → verifies no files written, returns plan
// 7. Calls create_skill tool → verifies SKILL.md created with correct frontmatter
// 8. Verifies new skill immediately gets symlinks in .claude/skills/, .gemini/skills/, .codex/skills/
// 9. Calls sync_skills tool → verifies AGENTS.md updated with auto-invoke table
// 10. Calls sync_skills with check_only → verifies returns "in sync"
// 11. Modifies a skill's auto_invoke → calls sync_skills check_only → verifies returns "out of sync"
// 12. Calls sync_skills → verifies AGENTS.md updated
// 13. Deletes a skill directory → calls sync_skills → verifies orphaned symlinks removed
// 14. Cleans up temp directory
```

### Testing the Frontmatter Extraction

The most critical piece to test is that `gray-matter` extraction produces identical results to the bash version. Create test fixtures using the same SKILL.md files from `sync_test.sh`:

```typescript
// tests/utils.test.ts
import matter from 'gray-matter';

describe("extractMetadata", () => {
  it("extracts single-line scope", () => {
    // metadata:
    //   scope: [ui]
    // → ["ui"]
  });

  it("extracts multi-value scope", () => {
    // metadata:
    //   scope: [ui, api]
    // → ["ui", "api"]
  });

  it("extracts single-line auto_invoke", () => {
    // metadata:
    //   auto_invoke: "Testing UI components"
    // → ["Testing UI components"]
  });

  it("extracts list auto_invoke", () => {
    // metadata:
    //   auto_invoke:
    //     - "Action A"
    //     - "Action B"
    // → ["Action A", "Action B"]
  });

  it("returns empty for missing metadata", () => {
    // SKILL.md without scope/auto_invoke → []
  });

  it("preserves markdown body when modifying frontmatter", () => {
    // Read → modify metadata → stringify → body unchanged
  });
});
```

### Regression: Bash vs TypeScript Parity

Run both the bash sync and the MCP sync on the same test fixtures and diff the output:

```bash
# 1. Set up a test project with skills
# 2. Run bash sync.sh
# 3. Save resulting AGENTS.md
# 4. Reset AGENTS.md
# 5. Run MCP sync_skills tool
# 6. Diff the two AGENTS.md files — should be identical
```

---

## Example User Flow (After MCP Server Exists)

```
User: I want to set up AI configs for my new project at ~/projects/my-app

Claude: I'll use the agents-config MCP server to set that up.

[Calls setup_project(project_path="~/projects/my-app", assistants=["claude", "cursor"], dry_run=true)]

This would create:
  - ~/projects/my-app/AGENTS.md (from template)
  - ~/projects/my-app/skills/skill-creator/SKILL.md
  - ~/projects/my-app/skills/skill-sync/SKILL.md
  - ~/projects/my-app/CLAUDE.md
  - ~/projects/my-app/.claude/skills/skill-creator -> ../../skills/skill-creator
  - ~/projects/my-app/.claude/skills/skill-sync -> ../../skills/skill-sync
  - ~/projects/my-app/.cursorrules

Shall I proceed?

User: Yes

[Calls setup_project(project_path="~/projects/my-app", assistants=["claude", "cursor"])]

Done! Project configured.

User: Now create a skill for our React component patterns

Claude: [Calls create_skill(project_path="~/projects/my-app", skill_name="react-patterns", ...)]
        [Calls sync_skills(project_path="~/projects/my-app")]

Created skills/react-patterns/SKILL.md and updated AGENTS.md auto-invoke table.
New symlink: .claude/skills/react-patterns -> ../../skills/react-patterns
```

---

## Resolved Design Decisions

| Question | Decision | Rationale |
|----------|----------|-----------|
| **Transport** | `stdio` only | Secure, fast, zero network config. SSE only if a remote/team use case emerges. |
| **Config repo → target project** | **Copy** templates and base skills | Target project must be self-contained. Deleting the MCP server shouldn't break it. |
| **Within target project** | **Symlink** `.claude/skills/{name} → ../../skills/{name}` | The project's `skills/` dir is the source of truth; assistant dirs are discovery views. |
| **Assets root** | `__dirname` relative + `AGENTS_CONFIG_ROOT` env override | Works out of the box; env var for non-standard installations. |
| **YAML parsing** | `gray-matter` | Cleanly separates frontmatter from markdown body. Robust, battle-tested. Not a raw YAML parser (which would choke on markdown). |
| **Input validation** | `zod` schemas | Type-safe in TS, converts to MCP-compatible JSON Schema via `zod-to-json-schema`. |
| **Scope mapping** | Convention-based: `root` → `AGENTS.md`, `{scope}` → `{scope}/AGENTS.md` | No config file needed. Auto-discovers existing AGENTS.md files. |
| **Dry run** | All mutating tools support `dry_run` | Safety rail — returns a diff of what would change without writing anything. |
| **Windows** | Not supported | Symlinks on Linux/macOS work natively. No energy spent on Windows edge cases. |
