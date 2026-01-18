# Skill Sync Mechanism

The skill sync mechanism keeps AGENTS.md Auto-invoke sections in sync with skill metadata. When you create or modify a skill, running the sync script automatically updates all affected AGENTS.md files.

---

## How It Works

1. **Reads skill metadata** from `skills/*/SKILL.md` frontmatter
2. **Extracts scope and auto_invoke** fields
3. **Generates Auto-invoke tables** for each AGENTS.md
4. **Updates or inserts** the `### Auto-invoke Skills` section

---

## Required Skill Metadata

Each skill that should appear in Auto-invoke sections needs these fields in the frontmatter:

```yaml
---
name: my-skill
description: >
  What this skill does.
  Trigger: When to use it.
metadata:
  author: your-name
  version: "1.0"
  scope: [root]                    # Which AGENTS.md files
  auto_invoke: "Action description" # Or list of actions
---
```

### Single Action

```yaml
metadata:
  scope: [ui]
  auto_invoke: "Creating React components"
```

### Multiple Actions

```yaml
metadata:
  scope: [ui, api]
  auto_invoke:
    - "Creating React components"
    - "Modifying UI state"
```

---

## Scope Values

| Scope | Updates |
|-------|---------|
| `root` | `AGENTS.md` (repo root) |
| `ui` | `ui/AGENTS.md` |
| `api` | `api/AGENTS.md` |
| `sdk` | `sdk/AGENTS.md` or `{project}/AGENTS.md` |

Skills can have multiple scopes: `scope: [ui, api]`

---

## Usage

### Sync All AGENTS.md Files

```bash
./templates/skills/skill-sync/assets/sync.sh
```

### Dry Run (Preview Changes)

```bash
./templates/skills/skill-sync/assets/sync.sh --dry-run
```

### Check Mode (CI/Validation)

```bash
./templates/skills/skill-sync/assets/sync.sh --check
```

Returns exit code:
- `0` - All files in sync
- `1` - Changes needed

### Sync Specific Scope

```bash
./templates/skills/skill-sync/assets/sync.sh --scope ui
```

---

## Using with Makefile

If you have the project Makefile:

```bash
make sync   # Sync all AGENTS.md files
make check  # Check if in sync (for CI)
```

---

## Generated Output

Given this skill:

```yaml
# skills/prowler-ui/SKILL.md
metadata:
  scope: [ui]
  auto_invoke: "Creating React components"
```

The sync script generates in `ui/AGENTS.md`:

```markdown
### Auto-invoke Skills

When performing these actions, ALWAYS invoke the corresponding skill FIRST:

| Action | Skill |
|--------|-------|
| Creating React components | `prowler-ui` |
```

---

## CI Integration

Add to your CI pipeline:

```yaml
# .github/workflows/check-sync.yml
name: Check AGENTS.md Sync
on: [pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check sync
        run: ./templates/skills/skill-sync/assets/sync.sh --check
```

---

## Troubleshooting

### Skill not appearing in Auto-invoke

1. Check frontmatter has `metadata.scope` and `metadata.auto_invoke`
2. Run `./sync.sh --dry-run` to see what would be generated
3. Verify scope matches the AGENTS.md file you're checking

### "Skills missing sync metadata" warning

The sync script reports skills without sync metadata. This is informational - not all skills need auto-invoke rules.

To add metadata:

```yaml
metadata:
  scope: [root]
  auto_invoke: "Description of when to use"
```

### Changes not persisting

1. Ensure you're running from the correct directory
2. Check file permissions on AGENTS.md
3. Verify AGENTS.md exists for the specified scope

---

## Customizing Scope Paths

If your project structure differs, edit the `get_agents_path()` function in `sync.sh`:

```bash
get_agents_path() {
    local scope="$1"
    case "$scope" in
        root)       echo "$REPO_ROOT/AGENTS.md" ;;
        frontend)   echo "$REPO_ROOT/frontend/AGENTS.md" ;;
        backend)    echo "$REPO_ROOT/backend/AGENTS.md" ;;
        # Add custom scopes here
        *)          echo "" ;;
    esac
}
```

---

## Best Practices

1. **Run sync after modifying skills** - Keep Auto-invoke tables current
2. **Add to pre-commit hook** - Catch drift before committing
3. **Use --check in CI** - Fail builds if out of sync
4. **Keep auto_invoke descriptions concise** - They appear in tables
5. **Use multiple scopes sparingly** - Only when skill applies to multiple components
