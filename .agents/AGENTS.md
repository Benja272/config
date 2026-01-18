# AI Agents Config Repository Guidelines

## How to Use This Guide

This repository is a **meta-template** for setting up AI agent configurations. When working on this repo, follow these guidelines.

## Available Skills

| Skill | Description | URL |
|-------|-------------|-----|
| `skill-creator` | Create new AI agent skills | [SKILL.md](../templates/skills/skill-creator/SKILL.md) |
| `skill-sync` | Sync skill metadata to AGENTS.md | [SKILL.md](../templates/skills/skill-sync/SKILL.md) |
| `typescript` | TypeScript patterns and best practices | [SKILL.md](../templates/skills/typescript/SKILL.md) |
| `template-creator` | Create new templates for this repo | [SKILL.md](skills/template-creator/SKILL.md) |

### Auto-invoke Skills

When performing these actions, ALWAYS invoke the corresponding skill FIRST:

| Action | Skill |
|--------|-------|
| Creating new templates | `template-creator` |
| Creating/modifying skills | `skill-creator` |
| Updating skill metadata | `skill-sync` |
| After modifying any skill | `skill-sync` |
| Writing TypeScript code | `typescript` |

---

## Project Overview

This repo provides tools and templates for configuring AI coding assistants.

| Component | Location | Purpose |
|-----------|----------|---------|
| Templates | `templates/` | Generic, copy-ready templates |
| Examples | `examples/` | Real-world configuration examples |
| Orchestration | `orchestration/` | AI orchestration prompts |
| Documentation | `docs/` | Guides and concepts |
| Skills | `templates/skills/` | Reusable AI skills |

---

## Development Guidelines

### When Adding Templates

1. Templates must be **generic** - no project-specific content
2. Use placeholders: `{project-name}`, `{component}`, `{technology}`
3. Include comments explaining customization points
4. Add to `templates/README.md`

### When Adding Examples

1. Examples should be realistic and complete
2. Include a README explaining the context
3. Reference which templates they demonstrate
4. Add to `examples/README.md`

### When Modifying Skills

1. Update frontmatter `metadata.scope` and `metadata.auto_invoke`
2. Run `make sync` after changes
3. Update skill tests if applicable

### When Adding AI Assistant Support

1. Add `setup_{assistant}()` function to `setup.sh`
2. Add `--{assistant}` flag parsing
3. Add tests to `setup_test.sh`
4. Document in `docs/supported-assistants.md`

---

## Commands

```bash
# Configure AI assistants
./setup.sh --all           # All assistants
./setup.sh --claude        # Claude only

# Skill management
make sync                  # Sync AGENTS.md auto-invoke tables
make check                 # Check if sync is needed (CI)

# Testing
make test                  # Run all tests
./setup_test.sh           # Setup script tests
```

---

## Code Style & Conventions

### Shell Scripts
- Use `#!/bin/bash` shebang
- Include `set -e` for fail-fast
- Use lowercase for local variables
- Use UPPERCASE for constants/exports
- Add `--help` flag to all scripts

### Markdown
- Use ATX-style headers (`#`, `##`)
- Use fenced code blocks with language
- Tables for structured data
- Keep lines under 100 characters

### Templates
- Use `{placeholder}` syntax
- Document all placeholders
- Provide examples in comments

---

## QA Checklist

Before committing changes:

- [ ] Templates are generic (no project-specific content)
- [ ] Examples are documented with README
- [ ] Skills have proper metadata (`scope`, `auto_invoke`)
- [ ] AGENTS.md files are in sync (`make check`)
- [ ] Tests pass (`make test`)
- [ ] Documentation updated if needed
