# Templates

Generic, copy-ready templates for setting up AI agent configurations in any project.

## Available Templates

| Template | Purpose |
|----------|---------|
| [AGENTS.md.template](AGENTS.md.template) | Root repository guidelines |
| [COMPONENT-AGENTS.md.template](COMPONENT-AGENTS.md.template) | Component/service-specific guidelines |
| [SKILL.md.template](SKILL.md.template) | AI skill definition |
| [DOCS-STYLE-GUIDE.md.template](DOCS-STYLE-GUIDE.md.template) | Documentation style guide |

## Reusable Skills

The `skills/` folder contains generic skills that can be used in any project:

| Skill | Purpose |
|-------|---------|
| [skill-creator](skills/skill-creator/) | Create new AI agent skills |
| [skill-sync](skills/skill-sync/) | Sync skill metadata to AGENTS.md |
| [typescript](skills/typescript/) | TypeScript patterns and best practices |

## How to Use

### Manual Setup

1. Copy the templates you need to your project
2. Replace placeholders (marked with `{placeholder}`) with your values
3. Customize sections as needed
4. Run `setup.sh` to configure your AI assistants

### Automated Setup

Use the [orchestration prompt](../orchestration/generate-project-config.md) to have an AI generate configurations for your project using subagents.

## Placeholders

Templates use these placeholders:

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{project-name}` | Your project identifier | `myapp`, `acme-api` |
| `{component}` | Component/service name | `api`, `ui`, `sdk` |
| `{technology}` | Tech stack item | `Python 3.11`, `Next.js 15` |
| `{path}` | File system path | `src/`, `api/` |
| `{description}` | User-provided description | Any text |

## Customization Tips

- **Skills Table**: Add project-specific skills, remove irrelevant ones
- **Auto-invoke Rules**: Map your common actions to skills
- **QA Checklist**: Adjust to your project's testing requirements
- **Tech Stack**: Update to match your actual dependencies
