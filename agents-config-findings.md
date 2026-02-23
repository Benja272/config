# agents-config MCP Server — Findings & Status

Evaluated: 2026-02-22 | Updated: 2026-02-22

---

## BUGS — Fixed

| Bug | Issue | Fix Applied |
|-----|-------|-------------|
| BUG-1 (CRITICAL) | `setup_project` overwrites existing files | Added existence checks — skips with `SKIPPED` message if file/dir already exists |
| BUG-2 | `sync.sh` hardcoded Prowler scope paths | Replaced `case` statement with convention-based mapping (`scope` = directory name) |
| BUG-3 | `skill-creator` and `skill-sync` had Prowler-specific content | Replaced all Prowler naming, author, license, examples with generic `{project}-{component}` patterns |
| BUG-4 | `create_skill` syncs symlinks for ALL assistants | Reads `.agents-config.json` for configured assistants; also accepts optional `assistants` parameter |
| BUG-6 | `create_skill` hardcodes `Apache-2.0` + `gentleman-programming` | Reads `license` and `author` from `.agents-config.json`; template defaults changed to `MIT` / `"{author}"` |
| BUG-7 | `sync_skills` replaces manually-written Auto-invoke section | Added "Managed Sections" documentation to `skill-sync/SKILL.md` |
| BUG-8 | MCP `sync_skills` handles custom scopes but `sync.sh` doesn't | `sync.sh` now uses same convention as MCP: `scope` = directory name |
| BUG-9 | `skill-creator` missing `scope` and `auto_invoke` metadata | Added `scope: [root]` and `auto_invoke` entries to frontmatter |
| BUG-10 | `AGENTS.md.template` references nonexistent `typescript` skill | Removed `typescript` rows from Generic Skills and Auto-invoke tables |

## BUGS — Skipped

| Bug | Issue | Reason |
|-----|-------|--------|
| BUG-5 | `create_skill` duplicated trigger line | Could not reproduce — code path fully replaces description field. Deferred. |

---

## Structural Changes Implemented

### `.agents-config.json` (STRUCT-1)

`setup_project` now creates a project-level config file:

```json
{
  "project_name": "my-project",
  "assistants": ["claude"],
  "license": "MIT",
  "author": "my-project"
}
```

- `create_skill` reads it for symlink filtering + frontmatter defaults
- `sync_skills` reads it for symlink filtering
- `update_project` reads it to only check configured assistants
- Scope mapping uses convention (not config) — `scope` = directory name

### Convention-based scope resolution (STRUCT-2)

Both `sync.sh` and the MCP `resolveScopePath` now use the same logic:
- `root` → `AGENTS.md`
- `{anything-else}` → `{scope}/AGENTS.md`

No config needed — the scope name IS the directory path.

---

## Open Items — Not Yet Addressed

### Documentation Gaps

| Gap | Description |
|-----|-------------|
| GAP-1 | No guidance on Component AGENTS.md vs Skills content separation |
| GAP-3 | No documentation/examples for non-monorepo or Python projects |
| GAP-4 | `setup_project` output lists files for unselected assistants in "Next Steps" |

### Future Recommendations

| Item | Description | Priority |
|------|-------------|----------|
| STRUCT-3 | Separate `trigger` from `description` as top-level frontmatter field | Medium — breaking change, needs schema migration |
| STRUCT-4 | `validate_skills` MCP tool for checking frontmatter completeness | Low — manual review suffices for now |
| REC-3 | `doc://content-separation` resource | Medium |
| REC-4 | Template variables for `setup_project` | Low |
| REC-6 | `--strict` flag for `sync.sh` CI mode | Low |
| REMOVE-3 | Flatten `metadata.*` fields to top level | Medium — breaking change |
| REMOVE-4 | Remove unused `allowed-tools` field from built-in skills | Low |

---

## Positive Findings

- Resource URI system (`doc://`, `template://`, `example://`, `skill://`) is well-designed
- Progressive disclosure concept is sound and well-explained
- `dry_run` available on most tools
- `sync_skills --check` mode is useful for CI
- Cognitive hierarchy model is a clean mental model
- Prowler examples remain valuable as real-world reference
