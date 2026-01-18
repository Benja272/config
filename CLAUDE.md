# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repository Is

A meta-template for setting up AI agent configurations across multiple coding assistants. Contains generic templates, reusable skills, and orchestration prompts for generating `AGENTS.md` files in other projects.

## Commands

```bash
# Setup AI assistants
./setup.sh --all          # Configure all (Claude, Gemini, Codex, Copilot, Cursor)
./setup.sh --claude       # Claude Code only
./setup.sh --cursor       # Cursor only

# Skill sync
make sync                 # Update AGENTS.md auto-invoke tables from skill metadata
make check                # Check if in sync (for CI, exits 1 if drift detected)

# Testing
make test                 # Run all tests (setup_test.sh + sync_test.sh)
./setup_test.sh           # Setup script tests only
./templates/skills/skill-sync/assets/sync_test.sh  # Sync tests only
```

## Architecture

```
config/
├── templates/              # Generic, copy-ready templates
│   ├── *.template          # AGENTS.md, SKILL.md, etc. with {placeholders}
│   └── skills/             # Reusable skills (skill-creator, skill-sync, typescript)
├── examples/prowler/       # Real-world example configs
├── orchestration/          # Multi-phase prompts for generating configs via subagents
├── docs/                   # Concepts (subagents vs skills), assistant comparisons
├── .agents/                # Dogfooding: this repo's own AGENTS.md and skills
├── setup.sh                # Configures AI assistants (creates symlinks, copies files)
└── Makefile                # Convenience targets
```

## Key Concepts

**Skills**: Modular knowledge packages in `skills/{name}/SKILL.md`. Use progressive disclosure—agent sees only description until activated. Skills define `metadata.scope` and `metadata.auto_invoke` for automatic table generation.

**Subagents**: Isolated specialists spawned via Task tool with separate context windows. Use for complex workflows, parallel execution, or when isolation improves accuracy.

**Skill Sync**: The `sync.sh` script reads skill frontmatter and generates "Auto-invoke Skills" tables in AGENTS.md files. Each skill's `scope` determines which AGENTS.md files get updated.

## Working on This Repo

### Templates Must Be Generic
- No project-specific names or paths—use placeholders: `{project-name}`, `{component}`, `{technology}`
- Templates live in `templates/`, examples in `examples/`

### After Modifying Skills
Run `make sync` to regenerate auto-invoke tables. The `--check` flag validates without writing (for CI).

### Shell Script Style
- `#!/bin/bash` shebang, `set -e` for fail-fast
- Lowercase locals, UPPERCASE constants
- Add `--help` flag to new scripts

### Adding AI Assistant Support
1. Add `setup_{assistant}()` function to `setup.sh`
2. Add flag parsing
3. Add tests to `setup_test.sh`
4. Document in `docs/supported-assistants.md`
