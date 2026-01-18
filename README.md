# AI Agents Config

A meta-template repository for setting up AI-friendly project configurations. Provides templates, skills, and orchestration prompts for configuring AI coding assistants.

## Quick Start

```bash
# Clone this repo
git clone https://github.com/your-org/config.git
cd config

# Configure all AI assistants
./setup.sh --all

# Or select specific ones
./setup.sh --claude --cursor
```

## What This Does

This repository helps you configure multiple AI coding assistants with consistent project guidelines:

| Assistant | Config Created |
|-----------|---------------|
| Claude Code | `.claude/skills/` + `CLAUDE.md` |
| Gemini CLI | `.gemini/skills/` + `GEMINI.md` |
| Codex (OpenAI) | `.codex/skills/` + uses `AGENTS.md` |
| GitHub Copilot | `.github/copilot-instructions.md` |
| Cursor | `.cursorrules` |

## Repository Structure

```
config/
├── templates/              # Generic, copy-ready templates
│   ├── AGENTS.md.template  # Root config template
│   ├── COMPONENT-AGENTS.md.template
│   ├── SKILL.md.template
│   ├── DOCS-STYLE-GUIDE.md.template
│   └── skills/             # Reusable AI skills
│       ├── skill-creator/
│       ├── skill-sync/
│       └── typescript/
│
├── examples/               # Real-world examples
│   └── prowler/           # Prowler security tool example
│
├── orchestration/          # AI orchestration prompts
│   └── generate-project-config.md
│
├── docs/                   # Documentation
│   ├── concepts.md        # Subagents vs Skills
│   ├── supported-assistants.md
│   └── skill-sync.md
│
├── setup.sh               # Main setup script
├── setup_test.sh          # Tests for setup.sh
└── Makefile               # Convenience commands
```

## Using Templates

### For a New Project

1. Copy the templates you need:
   ```bash
   cp templates/AGENTS.md.template your-project/AGENTS.md
   ```

2. Replace placeholders (`{project-name}`, `{component}`, etc.)

3. Run setup in your project:
   ```bash
   ./setup.sh --all
   ```

### With AI Orchestration

Use the orchestration prompt for AI-assisted config generation:

1. Open Claude Code in your project
2. Reference `orchestration/generate-project-config.md`
3. Let Claude spawn subagents for each phase
4. Review and customize the generated configs

## Key Concepts

### AGENTS.md

The main configuration file that AI assistants read. Contains:
- Project overview and structure
- Available skills and when to use them
- Auto-invoke rules (action -> skill mapping)
- Code conventions and QA checklists

### Skills

Modular knowledge packages that AI can load on-demand:
- Located in `skills/{name}/SKILL.md`
- Progressive disclosure (description first, details when needed)
- Defined triggers for automatic activation

### Subagents

Isolated specialists for complex tasks:
- Fresh context window (no clutter)
- Restricted permissions possible
- Parallel execution support

See [docs/concepts.md](docs/concepts.md) for details.

## Commands

```bash
# Setup
./setup.sh --all          # Configure all AI assistants
./setup.sh --claude       # Claude Code only
./setup.sh --cursor       # Cursor only

# Skill sync
make sync                 # Update AGENTS.md auto-invoke tables
make check                # Check if sync needed (for CI)

# Testing
make test                 # Run all tests
```

## Supported Assistants

| Feature | Claude | Gemini | Codex | Copilot | Cursor |
|---------|--------|--------|-------|---------|--------|
| AGENTS.md | Yes | Yes | Yes | Yes | Yes |
| Skills | Yes | Yes | Yes | No | No |
| Subagents | Yes | Partial | Partial | No | No |
| Auto-invoke | Yes | Yes | Yes | No | No |

See [docs/supported-assistants.md](docs/supported-assistants.md) for details.

## Contributing

1. **Templates** must be generic (no project-specific content)
2. **Examples** should be realistic and documented
3. **Skills** need proper metadata (`scope`, `auto_invoke`)
4. Run `make check` before committing

## License

Apache-2.0
