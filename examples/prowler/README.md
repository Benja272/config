# Prowler Example

This example shows AI agent configuration for [Prowler](https://github.com/prowler-cloud/prowler), an open-source cloud security assessment tool.

## Project Context

Prowler is a **monorepo** containing:

| Component | Tech Stack | Purpose |
|-----------|------------|---------|
| SDK | Python 3.9+, Poetry | Core security checks engine |
| API | Django 5.1, DRF, Celery | Backend service |
| UI | Next.js 15, React 19, Tailwind 4 | Web interface |
| MCP Server | FastMCP, Python 3.12+ | AI integration |

## Files in This Example

| File | Demonstrates |
|------|--------------|
| [AGENTS.md](AGENTS.md) | Root config with skills table, auto-invoke rules, project overview |
| [api-AGENTS.md](api-AGENTS.md) | Component-specific config for Django API |
| [docs-style-guide.md](docs-style-guide.md) | Project-specific documentation style guide |

## Key Patterns Demonstrated

1. **Skills Organization** - Generic skills (typescript, pytest) + project-specific skills (prowler-api, prowler-ui)
2. **Auto-invoke Rules** - Mapping actions to skills for automatic invocation
3. **Component Override** - How component docs can override root guidelines
4. **Decision Trees** - Serializer selection, task vs view decisions
5. **QA Checklists** - Component-specific validation steps
