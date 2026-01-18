# Core Concepts: Subagents vs Skills

Understanding the distinction between **Subagents** and **Skills** is key to creating AI agent configurations that are both powerful and token-efficient.

---

## The Cognitive Hierarchy

In the AGENTS.md framework, subagents and skills represent a **Cognitive Hierarchy** for AI assistants:

```
Root Agent (main conversation)
├── Subagents (isolated specialists)
│   ├── StrategyArchitect
│   └── StatValidator
└── Skills (shared knowledge)
    ├── typescript
    ├── pytest
    └── risk-calc
```

---

## 1. Subagents: The "Who" (Specialized Personnel)

Subagents are **independent entities** with their own context window. They are used to **isolate complexity**.

### Characteristics

| Aspect | Description |
|--------|-------------|
| **Context** | Separate (fresh start) |
| **Purpose** | Complex, multi-step workflows |
| **Isolation** | High - won't clutter main conversation |
| **Best For** | Tasks requiring multiple rounds of reasoning |

### When to Use Subagents

- Multi-step workflows requiring focus
- Tasks that generate verbose logs or intermediate outputs
- Operations that need restricted permissions
- Parallel processing of independent tasks

### Example Use Cases

```
StrategyArchitect  - Only writes code logic
StatValidator      - Only judges results, can't modify code
DataProcessor      - Only transforms data
TestRunner         - Only executes tests
```

### Subagent Definition (in AGENTS.md)

```markdown
## Subagents

### StrategyArchitect
- **Role**: Writes business logic and algorithms
- **Tools**: read, write, bash (restricted)
- **Cannot**: Modify test files, access production data

### StatValidator
- **Role**: Validates statistical significance
- **Tools**: read, bash (read-only)
- **Cannot**: Modify any files
```

---

## 2. Skills: The "How" (Tools & Knowledge)

Skills are **modular capabilities** that any agent (root or subagent) can "pick up" when needed.

### Characteristics

| Aspect | Description |
|--------|-------------|
| **Context** | Shared (in-context) |
| **Purpose** | Repeatable, specific tasks |
| **Isolation** | Low - knowledge sharing |
| **Best For** | Saving tokens, consistent patterns |

### Progressive Disclosure

Skills use **Progressive Disclosure**:
1. Agent first sees only the skill's description (~100 tokens)
2. If the task matches, agent "activates" the skill
3. Full instructions and assets are then loaded

This keeps context lean until knowledge is actually needed.

### When to Use Skills

- Repeatable "procedural knowledge"
- Things that should be done the same way every time
- Patterns specific to your tech stack
- Code templates and schemas

### Example Use Cases

```
typescript     - TypeScript patterns and type definitions
risk-calc      - Python script for calculating drawdown
backtest-fmt   - JSON schema for backtest results
api-patterns   - REST API conventions for your project
```

### Skill Structure

```
skills/{skill-name}/
├── SKILL.md              # Main skill file (required)
├── assets/               # Templates, schemas, scripts
│   ├── template.py
│   └── schema.json
└── references/           # Links to documentation
    └── docs.md
```

---

## 3. Decision Guide: When to Use What?

### Use a Subagent When

- [ ] Task requires multiple files and reasoning steps
- [ ] Output would clutter the main conversation
- [ ] You need to restrict what the agent can do
- [ ] Task can run in parallel with other work
- [ ] Context isolation improves accuracy

### Use a Skill When

- [ ] Pattern is repeated across the project
- [ ] Task is procedural (same steps every time)
- [ ] You want to share knowledge between agents
- [ ] Token efficiency is important
- [ ] The "how" matters more than the "who"

### Summary Table

| Feature | **Subagent** | **Skill** |
|---------|--------------|-----------|
| **Context** | Separate (Fresh start) | Shared (In-context) |
| **Best For** | Long, complex workflows | Repeatable, specific tasks |
| **Isolation** | High (Safety/Focus) | Low (Knowledge sharing) |
| **Efficiency** | Best for avoiding "noise" | Best for saving tokens |
| **Defined In** | AGENTS.md subagent section | skills/{name}/SKILL.md |
| **Invoked By** | Task tool with prompt | Skill tool or auto-invoke |

---

## 4. Combining Subagents and Skills

The most powerful configurations combine both:

```
Root Agent
├── Uses: typescript, api-patterns skills
│
├── Spawns: CodeReviewer subagent
│   └── Uses: typescript, security-audit skills
│
└── Spawns: TestRunner subagent
    └── Uses: pytest, coverage skills
```

### Example Workflow

1. **Root Agent** receives task: "Add user authentication"
2. **Root Agent** activates `api-patterns` skill for conventions
3. **Root Agent** spawns `CodeReviewer` subagent for security review
4. **CodeReviewer** activates `security-audit` skill
5. **CodeReviewer** reports back to Root Agent
6. **Root Agent** spawns `TestRunner` for validation
7. **TestRunner** uses `pytest` skill for test patterns

---

## 5. Best Practices

### For Subagents

1. **Define clear boundaries** - What can/can't they do?
2. **Limit tools** - Only give access to what's needed
3. **Specify output format** - How should they report back?
4. **Use for isolation** - Keep noisy operations contained

### For Skills

1. **Keep skills focused** - One pattern per skill
2. **Use progressive disclosure** - Description should be scannable
3. **Include examples** - Show don't tell
4. **Define triggers** - When should this skill activate?
5. **Add auto-invoke rules** - Map actions to skills in AGENTS.md
