# Generate AI Agent Configuration for a Project

## Purpose

This orchestration prompt guides Claude Code to analyze a project and generate comprehensive AGENTS.md configurations using the Task tool with subagents.

## How to Use

1. Open Claude Code in your project's root directory
2. Run: `claude` or start a conversation
3. Paste this prompt or reference it
4. Let Claude spawn subagents for each phase
5. Review the generated files

---

## Master Orchestration Prompt

```
I need you to generate AI agent configuration files for this project. Follow this multi-phase process, spawning subagents for each phase using the Task tool.

### Phase 1: Project Analysis

Spawn an Explore subagent to analyze the project:

Task prompt:
"Analyze this project's structure and architecture:
1. Identify the folder structure and main directories
2. Detect the tech stack (languages, frameworks, package managers)
3. Map components/services and their relationships
4. Find existing documentation and conventions
5. Note any monorepo structure or microservices
6. Look for existing AGENTS.md, CLAUDE.md, or similar files

Output a structured report with:
- Project type (monorepo, single app, library, etc.)
- Tech stack summary
- Component map with paths
- Existing conventions found
- Recommended skill categories"

### Phase 2: Root AGENTS.md + Assistant-Specific Files

After reviewing Phase 1 results, spawn a subagent to create the root config and assistant files:

Task prompt:
"Create the AI agent configuration files for this project based on the analysis.

**Step 1 — AGENTS.md (source of truth)**:
Use this template structure:
- How to Use This Guide section
- Available Skills table (list relevant skills from templates/skills/)
- Auto-invoke Skills table (map common actions to skills)
- Project Overview table (components, locations, tech stack)
- Development Setup section (install, dev, test commands)
- Code Style & Conventions section
- Commit & PR Guidelines section
- QA Checklist section

Make it specific to this project's tech stack and structure.
Write the file to AGENTS.md at the repository root.

**Step 2 — CLAUDE.md (Claude Code)**:
Start from AGENTS.md, then add Claude-specific sections:
- Task tool usage for spawning subagents (define specialist roles)
- MCP tool references if agents-config server is connected
- Skill progressive disclosure notes
- allowed-tools directives per skill if applicable
Write to CLAUDE.md at the repository root.

**Step 3 — Other assistant files**:
- GEMINI.md: Adapt AGENTS.md for Gemini CLI conventions.
- .cursorrules: Strip skills/subagent references. Inline critical rules. Keep concise.
- .github/copilot-instructions.md: Strip skills. Focus on conventions and patterns.

Each file should be tailored — NOT identical copies."

### Phase 3: Component AGENTS.md Generation

For each major component identified in Phase 1, spawn a subagent:

Task prompt (per component):
"Create an AGENTS.md file for the {component} component at {path}/AGENTS.md.

Include:
- Skills Reference pointing to relevant skills
- Auto-invoke Skills for component-specific actions
- CRITICAL RULES section with ALWAYS/NEVER patterns
- Decision trees for common choices
- Tech stack details
- Project structure for this component
- Commands (dev, test, lint)
- QA Checklist

Reference the root AGENTS.md and ensure consistency."

### Phase 4: Skill Generation (Optional)

If the project has unique patterns not covered by generic skills, spawn a subagent:

Task prompt:
"Create a project-specific skill for {pattern}.

Skill location: skills/{project-name}-{pattern}/SKILL.md

Include:
- Frontmatter with name, description, trigger, metadata
- When to Use section
- Critical Patterns with code examples
- Decision trees if applicable
- Commands section
- Set metadata.scope and metadata.auto_invoke appropriately

Follow the template at templates/SKILL.md.template."

### Phase 5: Validation

Spawn a final subagent to validate:

Task prompt:
"Validate the generated AGENTS.md configuration:
1. Check all AGENTS.md files exist and have consistent format
2. Verify all referenced skills exist
3. Ensure auto-invoke rules are logical
4. Check for broken links
5. Verify commands are correct for the tech stack

Report any issues found and suggest fixes."

### Phase 6: Setup

After validation, run the setup script:

```bash
./setup.sh --all
```

This configures all AI assistants (Claude, Gemini, Codex, Copilot, Cursor).

Or use the MCP `setup_project` tool if the agents-config server is connected:
"Call setup_project with project_path set to this project's root."
```

---

## Understanding the Config Files

Each AI assistant reads a different file, and **they should NOT all be identical copies**. Each file should be tailored to that assistant's capabilities.

### File Purposes

| File | Assistant | Skills? | Subagents? | Key Differences |
|------|-----------|---------|------------|-----------------|
| `AGENTS.md` | Codex (OpenAI) | Yes | Partial | Source of truth. Generic format all assistants understand. |
| `CLAUDE.md` | Claude Code | Yes | Yes (Task tool) | Can reference Task tool, MCP tools, progressive disclosure, `allowed-tools` directives. Most capable. |
| `GEMINI.md` | Gemini CLI | Yes | Partial | Adapt for Gemini's conventions and tool capabilities. |
| `.cursorrules` | Cursor | No | No | Include all rules inline. Keep concise — Cursor has token limits. No skill references. |
| `.github/copilot-instructions.md` | GitHub Copilot | No | No | Focus on code conventions and patterns. No skill references. |

### How to Differentiate

Start from `AGENTS.md` as the base, then customize:

- **CLAUDE.md** — Add sections on: how to use Task tool for spawning subagents, MCP tool integration, skill progressive disclosure patterns, allowed-tools per skill.
- **GEMINI.md** — Similar to Claude but adapted for Gemini CLI syntax and capabilities.
- **.cursorrules** — Strip out skill references and subagent sections. Inline the most critical rules and patterns. Prioritize brevity.
- **copilot-instructions.md** — Strip out skills. Focus on naming conventions, code patterns, and common operations.

### Subfolder AGENTS.md Files

For projects with distinct components (monorepos, multi-service architectures), create scoped config files:

```
project/
├── AGENTS.md              # Root — cross-project norms
├── api/AGENTS.md          # API-specific rules, tech stack, commands
├── ui/AGENTS.md           # Frontend-specific patterns, components
└── shared/AGENTS.md       # Shared library conventions
```

**Purpose**: When an AI subagent works inside `api/`, it reads `api/AGENTS.md` for focused, component-specific guidance. This prevents token waste from loading irrelevant frontend rules.

**When to create**:
- Each folder has a different tech stack (e.g., Python API + React UI)
- Components have distinct commands (different test/lint/dev commands)
- Team conventions differ per component
- The codebase is large enough that root-level guidance is too generic

**Rule**: Component AGENTS.md overrides root when guidance conflicts. Root defines shared norms; components define specifics.

Use `COMPONENT-AGENTS.md.template` as the base for each subfolder config.

---

## Using Subagents to Solve Tickets

A primary use case for skills and AGENTS.md is enabling AI to **solve tickets autonomously** using subagents. Each subagent reads the relevant AGENTS.md (root or component-scoped) and follows the project's conventions.

### Ticket-Solving Workflow

```
User: "Solve ticket PROJ-123: Add rate limiting to the API"

Root Agent (reads CLAUDE.md):
├── 1. Fetch ticket details (via MCP tool or user description)
├── 2. Analyze scope: which components are affected?
├── 3. Spawn subagents per component:
│   ├── Subagent A (reads api/AGENTS.md):
│   │   ├── Activates relevant skills (e.g., api-patterns, testing)
│   │   ├── Implements the feature following component conventions
│   │   └── Writes tests following the QA checklist
│   └── Subagent B (reads shared/AGENTS.md):
│       └── Updates shared types/interfaces if needed
├── 4. Root agent reviews all changes for consistency
├── 5. Runs tests, linting, validation
└── 6. Updates ticket status (via MCP tool)
```

### What Makes This Work

- **AGENTS.md** tells the agent *what conventions to follow* and *what commands to run*
- **Skills** give the agent *how-to knowledge* for specific patterns (loaded on demand)
- **Subfolder AGENTS.md** scopes the agent to the right component context
- **MCP tools** let the agent interact with external systems (Linear, GitHub, etc.)

### Recommended Skills for Ticket Workflows

When setting up a project for ticket-solving, consider creating these skills:

| Skill | Purpose |
|-------|---------|
| `ticket-creator` | Creates tickets with correct labels, estimates, formatting |
| `{project}-{component}` | Component-specific patterns and conventions |
| `testing` | Testing patterns for the project's test framework |
| `deployment` | Deployment procedures and checklists |

The generic `ticket-creator` skill template is available at `templates/skills/ticket-creator/`.

### Defining Subagent Roles in CLAUDE.md

In your CLAUDE.md, define specialist subagent roles that match your team structure:

```markdown
## Subagents

### FeatureBuilder
- **Role**: Implements features following project conventions
- **Context**: Reads component AGENTS.md + activates relevant skills
- **Tools**: read, write, edit, bash (restricted to dev/test commands)
- **Cannot**: Modify CI/CD, push to main, deploy

### CodeReviewer
- **Role**: Reviews changes for correctness and convention compliance
- **Context**: Reads root AGENTS.md + QA checklist
- **Tools**: read, grep, glob (read-only)
- **Cannot**: Modify files

### TestRunner
- **Role**: Writes and runs tests for new changes
- **Context**: Reads component AGENTS.md + testing skill
- **Tools**: read, write, bash (test commands only)
- **Cannot**: Modify production code
```

---

## Example Usage

### For a Next.js + Python API Monorepo

```
User: Generate AI agent config for this project

Claude: I'll analyze the project and generate configurations using subagents.

[Spawns Explore subagent for Phase 1]

Analysis complete. This is a monorepo with:
- ui/ - Next.js 15 frontend
- api/ - FastAPI Python backend
- shared/ - Shared types/utilities

[Spawns subagent for Phase 2 - Root AGENTS.md]
[Spawns subagent for Phase 3 - ui/AGENTS.md]
[Spawns subagent for Phase 3 - api/AGENTS.md]
[Spawns subagent for Phase 5 - Validation]

All configurations generated and validated. Run `./setup.sh --all` to configure your AI assistants.
```

---

## Customization

### Skip Phases

If you only need specific phases:
- "Only run Phase 1 to analyze the project"
- "Skip Phase 4, we don't need custom skills"

### Focus Areas

Direct the analysis:
- "Focus on the API component"
- "Pay special attention to testing patterns"
- "Include detailed TypeScript conventions"

### Existing Config

If you have partial config:
- "Update the existing AGENTS.md, don't replace it"
- "Add skills for the new authentication module"

---

## Output Files

After running this orchestration, you should have:

```
project/
├── AGENTS.md                 # Root configuration
├── {component}/AGENTS.md     # Per-component configs
├── skills/                   # Project-specific skills (if created)
│   └── {project}-{skill}/
│       └── SKILL.md
├── .claude/skills/           # Symlink (after setup.sh)
├── .cursorrules              # Cursor config (after setup.sh)
└── .github/
    └── copilot-instructions.md  # Copilot config (after setup.sh)
```
