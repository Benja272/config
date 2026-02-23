---
name: skill-sync
description: >
  Syncs skill metadata to AGENTS.md Auto-invoke sections.
  Trigger: When updating skill metadata (metadata.scope/metadata.auto_invoke), regenerating Auto-invoke tables, or running ./skills/skill-sync/assets/sync.sh (including --dry-run/--scope).
license: MIT
metadata:
  version: "1.0"
  scope: [root]
  auto_invoke:
    - "After creating/modifying a skill"
    - "Regenerate AGENTS.md Auto-invoke tables (sync.sh)"
    - "Troubleshoot why a skill is missing from AGENTS.md auto-invoke"
allowed-tools: Read, Edit, Write, Glob, Grep, Bash
---

## Purpose

Keeps AGENTS.md Auto-invoke sections in sync with skill metadata. When you create or modify a skill, run the sync script to automatically update all affected AGENTS.md files.

## Required Skill Metadata

Each skill that should appear in Auto-invoke sections needs these fields in `metadata`.

`auto_invoke` can be either a single string **or** a list of actions:

```yaml
metadata:
  version: "1.0"
  scope: [ui]                                    # Which AGENTS.md to update (scope = directory name)

  # Option A: single action
  auto_invoke: "Creating/modifying components"

  # Option B: multiple actions
  # auto_invoke:
  #   - "Creating/modifying components"
  #   - "Refactoring component folder placement"
```

### Scope Values

Scopes map to directories by convention: the scope name is the directory containing `AGENTS.md`.

| Scope | Updates |
|-------|---------|
| `root` | `AGENTS.md` (repo root) |
| `{directory}` | `{directory}/AGENTS.md` |

Examples: `scope: [root]`, `scope: [ui, api]`, `scope: [src/core]`

Skills can have multiple scopes: `scope: [root, api]`

---

## Usage

### After Creating/Modifying a Skill

```bash
./skills/skill-sync/assets/sync.sh
```

### What It Does

1. Reads all `skills/*/SKILL.md` files
2. Extracts `metadata.scope` and `metadata.auto_invoke`
3. Generates Auto-invoke tables for each AGENTS.md
4. Updates the `### Auto-invoke Skills` section in each file

### Managed Sections

The `### Auto-invoke Skills` section in AGENTS.md is **fully managed** by the sync process. Any manual edits to this section will be overwritten on the next sync run. To customize which skills appear, modify the skill's `metadata.scope` and `metadata.auto_invoke` fields instead.

---

## Example

Given this skill metadata:

```yaml
# skills/myapp-ui/SKILL.md
metadata:
  version: "1.0"
  scope: [ui]
  auto_invoke: "Creating/modifying React components"
```

The sync script generates in `ui/AGENTS.md`:

```markdown
### Auto-invoke Skills

When performing these actions, ALWAYS invoke the corresponding skill FIRST:

| Action | Skill |
|--------|-------|
| Creating/modifying React components | `myapp-ui` |
```

---

## Commands

```bash
# Sync all AGENTS.md files
./skills/skill-sync/assets/sync.sh

# Dry run (show what would change)
./skills/skill-sync/assets/sync.sh --dry-run

# Sync specific scope only
./skills/skill-sync/assets/sync.sh --scope ui
```

## Usage via MCP

If the `agents-config` MCP server is connected, use the `sync_skills` tool instead of running the script directly. The MCP tool provides the same functionality with `check_only`, `scope`, and `dry_run` options.

---

## Checklist After Modifying Skills

- [ ] Added `metadata.scope` to new/modified skill
- [ ] Added `metadata.auto_invoke` with action description
- [ ] Ran `./skills/skill-sync/assets/sync.sh`
- [ ] Verified AGENTS.md files updated correctly