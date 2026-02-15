---
name: ticket-creator
description: >
  Creates project management tickets with correct labels, estimates, and formatting.
  Trigger: When user asks to create a ticket, file an issue, or add an implementation task.
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0"
  scope: [root]
  auto_invoke:
    - "Creating a ticket or issue"
    - "Filing a bug report"
    - "Adding an implementation task"
allowed-tools: Read, Glob, Grep
---

## When to Use

- User asks to create a ticket or issue
- User wants to file a bug report
- User wants to add a new implementation task
- User references creating tickets from a backlog or spec document

---

## Critical Configuration

Customize these values for your project:

| Setting | Value | Notes |
|---------|-------|-------|
| **Team** | `{team-name}` | Your project management team |
| **Default Label** | `{service-label}` | Primary service/repo label |
| **Tool** | `{mcp-tool-name}` | MCP tool for creating issues (e.g., `mcp__linear__create_issue`, `mcp__github__create_issue`) |

---

## Decision Tree

```
User wants to create a ticket?
├── Is the service/component clear?
│   ├── Yes -> Use appropriate label
│   └── No -> Ask which service/component
│
Does user provide ticket details?
├── Title provided -> Use as-is
├── No title -> Ask for title
│
Does user specify estimate?
├── Points given (1,2,3,5,8,13) -> Use as estimate
├── Time given ("half day") -> Map to points (3 pts)
├── Time given ("full day") -> Map to points (5 pts)
├── Time given ("2-3 days") -> Map to points (8 pts)
└── Not specified -> Estimate based on scope, or ask
│
Does user specify priority?
├── P0/Urgent -> priority: 1
├── P1/High -> priority: 2
├── P2/Medium/Normal -> priority: 3
├── P3/Low -> priority: 4
└── Not specified -> Do NOT set priority (leave default)
```

---

## Ticket Format

### Title Convention
- Use ticket ID prefix if part of a series: `{PREFIX}-XXX: Title`
- Keep titles concise but descriptive

### Description Template

```markdown
**Service/Repo:** {primary-service} (+ {other-services} if cross-service)

## Description
{What needs to be done and why - be detailed}

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Dependencies
- {List any blocking tickets or external dependencies}

## Testing
- [ ] Unit test: {description}
- [ ] Integration test: {description}

## Files to Create/Modify
- `{service}/path/to/file` - {what changes}
```

---

## Sprint-Ready Ticket Checklist

A ticket is **sprint-ready** when it has ALL of the following:

| Field | Required | Notes |
|-------|----------|-------|
| Title | Yes | Clear, concise |
| Description | Yes | Detailed with acceptance criteria |
| Labels | Yes | Service label + type (Bug/Feature/Improvement) |
| Estimate | Yes | Fibonacci points (1, 2, 3, 5, 8) |
| Assignee | At sprint | Set during sprint planning |

**Backlog tickets** may omit estimate and assignee (set during refinement).

---

## Estimation (Fibonacci Points)

| Points | Effort | Examples |
|--------|--------|----------|
| **1** | Trivial | 1 line change, config update, small bug fix |
| **2** | Small | Few lines, 1 function/class, small change |
| **3** | Minor | Small feature, ~half day effort |
| **5** | Medium | Medium feature, ~full day effort |
| **8** | Large | Large feature, 2-3 days effort |
| **13** | Epic | Major feature with stages — **should be broken down** |

---

## Priority Mapping

| User Says | Priority Value |
|-----------|---------------|
| P0, Urgent, Blocker | 1 (Urgent) |
| P1, High | 2 (High) |
| P2, Medium, Normal | 3 (Normal) |
| P3, Low, Nice to have | 4 (Low) |

---

## Common Labels

| Label | Use When |
|-------|----------|
| `{service-label}` | **Always** — primary label for this service |
| `Bug` | Reporting a defect |
| `Feature` | New functionality |
| `Improvement` | Enhancement to existing functionality |
| `Infrastructure` | DevOps, deployment, CI/CD |

---

## Examples

### Example 1: Bug ticket (2 pts)

```json
{
  "title": "Fix validation error on form submission",
  "team": "{team-name}",
  "labels": ["{service-label}", "Bug"],
  "state": "Todo",
  "estimate": 2,
  "description": "**Service/Repo:** {service-name}\n\n## Description\n{Detailed description of the bug}\n\n## Steps to Reproduce\n1. ...\n2. ...\n\n## Expected Behavior\n{What should happen}\n\n## Actual Behavior\n{What actually happens}\n\n## Testing\n- [ ] Unit test: Verify fix\n- [ ] Integration test: End-to-end validation"
}
```

### Example 2: Feature ticket (5 pts)

```json
{
  "title": "Add WebSocket reconnection logic",
  "team": "{team-name}",
  "labels": ["{service-label}", "Feature"],
  "state": "Todo",
  "estimate": 5,
  "description": "**Service/Repo:** {service-name}\n\n## Description\n{What needs to be built and why}\n\n## Acceptance Criteria\n- [ ] Criterion 1\n- [ ] Criterion 2\n\n## Dependencies\n- {Any blocking work}\n\n## Testing\n- [ ] Unit test: {description}\n- [ ] Integration test: {description}\n\n## Files to Create/Modify\n- `path/to/file` - {what changes}"
}
```

### Example 3: Cross-service ticket (8 pts)

```json
{
  "title": "Implement cross-service RPC endpoint",
  "team": "{team-name}",
  "labels": ["{service-label}", "{other-service-label}", "Feature"],
  "state": "Todo",
  "estimate": 8,
  "description": "**Service/Repo:** {primary-service} (+ {secondary-service})\n\n## Description\n{What and why — spans multiple services}\n\n## Acceptance Criteria\n- [ ] Criterion 1\n- [ ] Criterion 2\n\n## Testing\n- [ ] Unit test: {description}\n- [ ] Integration test: {description}\n\n## Files to Create/Modify\n- `{primary-service}/path/to/file` - {changes}\n- `{secondary-service}/path/to/file` - {changes}"
}
```

---

## Resources

- **Templates**: See [assets/](assets/) for ticket description templates
- **Documentation**: See your project's implementation tickets or backlog documents for existing formats
