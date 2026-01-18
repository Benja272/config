# Supported AI Assistants

This configuration system supports multiple AI coding assistants. Each has different file conventions, but they all can use the same underlying AGENTS.md and skills.

---

## Quick Reference

| Assistant | Config File | Skills Location | Setup Command |
|-----------|-------------|-----------------|---------------|
| Claude Code | CLAUDE.md | .claude/skills/ | `--claude` |
| Gemini CLI | GEMINI.md | .gemini/skills/ | `--gemini` |
| Codex (OpenAI) | AGENTS.md | .codex/skills/ | `--codex` |
| GitHub Copilot | .github/copilot-instructions.md | N/A | `--copilot` |
| Cursor | .cursorrules | N/A | `--cursor` |

---

## Claude Code

**Anthropic's official CLI for Claude**

### Files
- `CLAUDE.md` - Copy of AGENTS.md (Claude looks for this)
- `.claude/skills/` - Symlink to skills directory

### Features
- Full AGENTS.md support
- Skills with progressive disclosure
- Subagent spawning via Task tool
- MCP server integration

### Setup
```bash
./setup.sh --claude
```

### Notes
- Claude Code natively supports the AGENTS.md format
- Skills are automatically discovered in `.claude/skills/`
- Subagents run in isolated context windows

---

## Gemini CLI

**Google's AI assistant for developers**

### Files
- `GEMINI.md` - Copy of AGENTS.md
- `.gemini/skills/` - Symlink to skills directory

### Features
- AGENTS.md-style configuration
- Skills support
- Integration with Google Cloud

### Setup
```bash
./setup.sh --gemini
```

### Notes
- Gemini uses similar conventions to Claude
- Skills are loaded from `.gemini/skills/`

---

## Codex (OpenAI)

**OpenAI's coding assistant**

### Files
- `AGENTS.md` - Used natively
- `.codex/skills/` - Symlink to skills directory

### Features
- Native AGENTS.md support
- Skills discovery
- Function calling for tools

### Setup
```bash
./setup.sh --codex
```

### Notes
- Codex natively reads AGENTS.md
- No file copying needed for main config
- Skills work similarly to Claude

---

## GitHub Copilot

**GitHub's AI pair programmer**

### Files
- `.github/copilot-instructions.md` - Copy of root AGENTS.md

### Features
- Repository-level instructions
- Context from open files
- Inline suggestions

### Setup
```bash
./setup.sh --copilot
```

### Notes
- Copilot uses a single instructions file
- No skills support (yet)
- Instructions apply to all Copilot features

### Limitations
- No subagent support
- No progressive skill disclosure
- Single flat configuration

---

## Cursor

**AI-first code editor**

### Files
- `.cursorrules` - Copy of root AGENTS.md

### Features
- Project-level rules
- Context-aware suggestions
- Inline and chat modes

### Setup
```bash
./setup.sh --cursor
```

### Notes
- Cursor reads `.cursorrules` at project root
- Rules apply to all Cursor AI features
- Format is plain markdown

### Limitations
- No skills folder support
- No subagent spawning
- Single configuration file

---

## Setup All Assistants

To configure all supported assistants at once:

```bash
./setup.sh --all
```

This creates:
- `.claude/skills/` symlink + CLAUDE.md copies
- `.gemini/skills/` symlink + GEMINI.md copies
- `.codex/skills/` symlink
- `.github/copilot-instructions.md`
- `.cursorrules`

---

## Feature Comparison

| Feature | Claude | Gemini | Codex | Copilot | Cursor |
|---------|--------|--------|-------|---------|--------|
| AGENTS.md | ✅ | ✅ | ✅ | ✅ | ✅ |
| Skills | ✅ | ✅ | ✅ | ❌ | ❌ |
| Subagents | ✅ | ⚠️ | ⚠️ | ❌ | ❌ |
| Auto-invoke | ✅ | ✅ | ✅ | ❌ | ❌ |
| MCP Servers | ✅ | ❌ | ❌ | ❌ | ✅ |
| IDE Integration | VSCode | Terminal | Terminal | All IDEs | Cursor |

**Legend:**
- ✅ Full support
- ⚠️ Partial support
- ❌ Not supported

---

## Adding New Assistants

To add support for a new AI assistant:

1. **Identify the config file** - What file does it read?
2. **Add setup function** to `setup.sh`:
   ```bash
   setup_newassistant() {
       cp "$REPO_ROOT/AGENTS.md" "$REPO_ROOT/{config-file}"
       echo -e "${GREEN}  ✓ AGENTS.md -> {config-file}${NC}"
   }
   ```
3. **Add flag parsing** for `--newassistant`
4. **Update tests** in `setup_test.sh`
5. **Document** in this file

---

## Troubleshooting

### Config not loading

1. Check file exists: `ls -la .cursorrules` (or relevant file)
2. Verify symlinks: `ls -la .claude/skills/`
3. Restart the AI assistant

### Skills not found

1. Ensure skills symlink is valid
2. Check SKILL.md files have correct frontmatter
3. Verify skill name matches folder name

### Changes not reflected

1. Re-run `./setup.sh` after changing AGENTS.md
2. Restart the AI assistant
3. Check for cached context
