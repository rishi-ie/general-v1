---
name: sub-agents
description: Spawn and manage sub-agents for parallel or specialized task execution. Use when a task can be broken into independent parts, when specialized knowledge is needed, or when multiple research directions need exploration. Built on nicobailon/pi-subagents.
---

# Sub-Agents

Spawn specialized sub-agents that run in isolated sessions — each with its own tools, system prompt, model, and thinking level. Built on [pi-subagents](https://github.com/nicobailon/pi-subagents).

## When to Use Sub-Agents

**Use when:**
- A task has independent subtasks that can run simultaneously
- Specialized knowledge is needed for a portion of work
- Multiple research directions need exploration
- A long-running task can be decomposed
- You want a second opinion before making a decision

**Don't use when:**
- Tasks are sequential and depend on each other
- Simple, quick tasks the main agent can handle
- Coordination overhead exceeds the benefit

## Available Agent Types

### Builtin Agents (pi-subagents)

| Type | Tools | Model | When to use |
|------|-------|-------|-------------|
| `scout` | read, bash, grep, find, ls | haiku | Fast codebase recon |
| `researcher` | web tools | inherit | Web/docs research with sources |
| `planner` | read, bash, grep, find, ls | inherit | Concrete implementation plans |
| `worker` | read, bash, grep, find, ls, edit | inherit | Implementation with approval |
| `reviewer` | read, bash, grep, find, ls, edit | inherit | Code review and validation |
| `oracle` | read, bash, grep, find, ls | inherit | Second opinion, challenge assumptions |
| `delegate` | All | inherit | General parent twin |
| `context-builder` | read, write | inherit | Setup pass before planning |

### General V1 Custom Agents

| Type | Tools | Model | When to use |
|------|-------|-------|-------------|
| `research` | web_search, fetch_content, read, write | inherit | Deep research synthesis |
| `writer` | read, write, edit, grep, find, ls | inherit | Technical documentation |
| `debugger` | read, bash, grep, find, ls | inherit | Systematic debugging |
| `auditor` | read, bash, grep, find, ls | inherit | Security and quality audit |

## Spawning Sub-Agents

### Natural Language (Recommended)

```
Use reviewer to review this diff.
Ask oracle for a second opinion on my current plan.
Run parallel reviewers: one for correctness, one for tests.
Have worker implement this approved plan.
Use scout to understand this codebase first.
```

### Slash Commands

```
/run reviewer "Review this diff"
/chain scout "scan codebase" -> planner "create plan"
/parallel scout "scan frontend" -> scout "scan backend"
```

### Programmatic (subagent tool)

```javascript
// Single agent
{ agent: "worker", task: "refactor auth" }

// Parallel
{ tasks: [{ agent: "scout", task: "audit frontend" }, { agent: "reviewer", task: "review backend" }] }

// Chain
{ chain: [{ agent: "scout", task: "Gather context" }, { agent: "planner" }, { agent: "worker" }] }

// Background
{ agent: "research", task: "Research competitor pricing", async: true }
```

## Managing Sub-Agents

### List Active Agents
```
Show me the current async runs.
```

### Get Results
```
subagent({ action: "status" })
subagent({ action: "status", id: "abc123" })
```

### Control
```
subagent({ action: "interrupt", id: "abc123" })
subagent({ action: "resume", id: "abc123", message: "Focus on auth" })
```

### Diagnostics
```
/subagents-doctor
Check whether subagents are configured correctly.
```

## Best Practices

### Task Definition
- Be clear and specific in prompts
- Define success criteria
- Set appropriate max turns

### Parallel Execution
- Spawn independent tasks simultaneously
- Use background mode for longer tasks
- Max concurrent: 4 (configurable)

### Result Collection
- Always collect and integrate results
- Handle partial results gracefully
- Report outputs to user

### Resource Management
- Don't spawn excessive agents
- Set appropriate turn limits
- Use read-only agents when possible

## Configuration

Settings in `v1/sub-agent/config.json`:
- `maxConcurrent` — Max parallel agents (default: 4)
- `defaultContext` — fork or fresh (default: fork)
- `asyncByDefault` — Run in background by default (default: false)
- `maxSubagentDepth` — Max nesting depth (default: 1)
- `agentDefaults` — Per-agent model and thinking overrides

## Relationship to Other Modules

| Module | Sub-agent integration |
|--------|----------------------|
| Planning | Agents create plan files; planner agent writes plans |
| Mission Control | Agents update tickets; reporter agent creates reports |
| Browser | Researcher agent does web research |
| Communication | Sub-agent status can stream to SuperHive |
| Permission | Delegation permissions go through permission/ module |
