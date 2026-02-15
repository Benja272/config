---
name: docs-management
description: >-
  Manages documentation lifecycle: validates docs stay in sync with code,
  generates docs from templates, and ensures consistency across README, docs/,
  and skill references.

  Trigger: When creating, modifying, or reviewing documentation files
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: '1.0'
  scope:
    - .agents
  auto_invoke:
    - Creating documentation
    - Modifying docs/ files
    - Updating README
---

## When to Use

Use this skill when:
- Creating new documentation files in `docs/`
- Updating `README.md` after adding features, templates, or skills
- Modifying existing docs and needing to verify cross-references
- Reviewing whether docs are in sync with the actual repo structure

---

## Critical Patterns

### Doc Locations and Ownership

| File/Directory | Purpose | Update When |
|---|---|---|
| `README.md` | Entry point, quick start, repo structure | Adding templates, skills, commands, or assistants |
| `docs/concepts.md` | Subagents vs Skills explanation | Changing the skill/subagent model |
| `docs/supported-assistants.md` | Assistant feature matrix | Adding assistant support in `setup.sh` |
| `docs/skill-sync.md` | Sync mechanism reference | Modifying `sync.sh` or MCP `sync_skills` tool |
| `docs/mcp-server-design.md` | MCP server architecture | Changing MCP tools, resources, or prompts |
| `CLAUDE.md` | Claude Code project instructions | Changing commands, architecture, or conventions |
| `.agents/AGENTS.md` | This repo's own AI agent config | Adding skills, changing dev guidelines |

### Keep README Structure in Sync

The `README.md` "Repository Structure" tree must reflect actual directories. When adding a new top-level directory or skill:

1. Update the tree in README.md
2. Update the components table if applicable
3. Verify all links resolve (no broken references)

### Cross-Reference Consistency

When a concept appears in multiple docs, ensure consistency:

```
README.md mentions "make sync"  ->  CLAUDE.md must list the same command
README.md lists 3 skills       ->  templates/skills/ must have those 3
docs/skill-sync.md references sync.sh  ->  that path must be correct
.agents/AGENTS.md lists skills  ->  links must point to real SKILL.md files
```

---

## Decision Tree

```
Adding a new skill?           -> Update README.md skills list + .agents/AGENTS.md table
Adding assistant support?     -> Update README.md matrix + docs/supported-assistants.md + CLAUDE.md
Changing a command?           -> Update README.md + CLAUDE.md + any docs referencing it
Adding an MCP tool/resource?  -> Update README.md MCP section + docs/mcp-server-design.md
Fixing a typo in docs/?      -> Fix it, no cross-reference check needed
Restructuring directories?   -> Update README.md tree + CLAUDE.md architecture + .agents/AGENTS.md
```

---

## Validation Checklist

When modifying docs, verify:

- [ ] `README.md` repo structure tree matches reality
- [ ] All `[link](path)` references resolve to existing files
- [ ] Command examples in docs match actual `Makefile` / `setup.sh` targets
- [ ] Skills listed in `.agents/AGENTS.md` match `templates/skills/` contents
- [ ] Assistant feature matrix matches `setup.sh` capabilities
- [ ] MCP tools table matches registered tools in `mcp-server/src/tools.ts`

---

## Commands

```bash
make check                    # Verify AGENTS.md auto-invoke tables are in sync
make sync                     # Regenerate auto-invoke tables from skill metadata
make test                     # Run all tests (catches broken references in scripts)
```

---

## Resources

- **Documentation**: See [docs/](../../docs/) for all project documentation
- **Templates**: See [templates/](../../templates/) for doc-related templates like `DOCS-STYLE-GUIDE.md.template`
