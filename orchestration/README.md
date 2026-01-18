# Orchestration Prompts

This folder contains AI orchestration prompts for generating agent configurations.

## Available Prompts

| Prompt | Purpose |
|--------|---------|
| [generate-project-config.md](generate-project-config.md) | Generate complete AGENTS.md configuration for a new project |

## How to Use

1. Open your AI assistant (Claude Code recommended)
2. Copy the prompt content or reference it
3. Point the AI at your project repository
4. Let it spawn subagents for each phase
5. Review and refine the generated configurations

## Design Philosophy

These prompts use a **subagent architecture**:
- Each phase is handled by a specialized subagent
- Subagents have focused context and specific goals
- The orchestrator coordinates the overall process
- Results are validated before finalization

This approach ensures:
- **Token efficiency** - Each subagent has minimal context
- **Specialization** - Each subagent excels at its specific task
- **Modularity** - Phases can be re-run independently
- **Quality** - Validation catches inconsistencies
