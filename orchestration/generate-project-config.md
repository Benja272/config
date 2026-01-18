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

### Phase 2: Root AGENTS.md Generation

After reviewing Phase 1 results, spawn a subagent to create the root config:

Task prompt:
"Create a root AGENTS.md file for this project based on the analysis.

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
Write the file to AGENTS.md at the repository root."

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
