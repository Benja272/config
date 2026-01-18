---
name: template-creator
description: >
  Creates new templates for the AI agents config repository.
  Trigger: When adding new template files to templates/ directory.
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0"
  scope: [root]
  auto_invoke:
    - "Creating new templates"
    - "Adding files to templates/"
allowed-tools: Read, Edit, Write, Glob, Grep
---

## When to Use

Use this skill when:
- Creating a new template file in `templates/`
- Generalizing an example into a template
- Adding a new template category

---

## Critical Rules

### Templates Must Be Generic

- **NO** project-specific names, paths, or content
- Use placeholders: `{project-name}`, `{component}`, `{technology}`
- Include comments explaining what to customize

### File Naming

```
{purpose}.md.template      # Markdown templates
{purpose}.template.{ext}   # Other file types
```

### Placeholder Conventions

| Placeholder | Usage | Example |
|-------------|-------|---------|
| `{project-name}` | Project identifier | `myapp` |
| `{component}` | Component/service name | `api`, `ui` |
| `{technology}` | Tech stack item | `Python 3.11` |
| `{path}` | File system path | `src/` |
| `{description}` | User-provided text | Any text |
| `{action}` | Action description | "Creating components" |
| `{skill-name}` | Skill identifier | `typescript` |

---

## Template Structure

Follow this general structure:

```markdown
# {Title}

{Brief description of this template's purpose}

---

## Section 1

{Content with {placeholders}}

---

## Section 2

| Column | Description |
|--------|-------------|
| `{item}` | {description} |

---

## Commands

```bash
{command}  # {description}
```
```

---

## Decision Tree

```
Creating AGENTS.md template?     -> Use AGENTS.md.template as base
Creating component config?       -> Use COMPONENT-AGENTS.md.template
Creating skill template?         -> Use SKILL.md.template
Creating style guide?            -> Use DOCS-STYLE-GUIDE.md.template
Something new?                   -> Create new .template file
```

---

## Code Examples

### Good Template

```markdown
# {project-name} API

## Overview

The {component} component handles {description}.

## Tech Stack

| Technology | Version |
|------------|---------|
| {technology} | {version} |
```

### Bad Template (Too Specific)

```markdown
# Prowler API                    <- Specific name!

## Overview

The API handles security scanning.  <- No placeholder!
```

---

## Checklist

Before creating a template:

- [ ] Removed all project-specific content
- [ ] All customization points use `{placeholder}` syntax
- [ ] Comments explain what each placeholder means
- [ ] Template has clear section structure
- [ ] Added to `templates/README.md`
- [ ] Tested by generating a sample config
