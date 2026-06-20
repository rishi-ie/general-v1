---
name: sub-agents
description: Spawn and manage sub-agents for parallel or specialized task execution. Use when a task can be broken into independent parts, when specialized knowledge is needed, or when multiple research directions need exploration. Built on @tintinweb/pi-subagents.
---

# Sub-Agents

Spawn specialized sub-agents that run in isolated sessions — each with its own tools, system prompt, model, and thinking level.

## When to Use Sub-Agents

**Use when:**
- A task has independent subtasks that can run simultaneously
- Specialized knowledge is needed for a portion of work
- Multiple research directions need exploration
- A long-running task can be decomposed

**Don't use when:**
- Tasks are sequential and depend on each other
- Simple, quick tasks the main agent can handle
- Coordination overhead exceeds the benefit

## Available Agent Types

| Type | Tools | Model | When to use |
|------|-------|-------|-------------|
| `general-purpose` | All | Inherit | Parent twin, follows same rules |
| `Explore` | read, bash, grep, find, ls | haiku | Fast codebase search |
| `Plan` | read, bash, grep, find, ls | Inherit | Software architecture planning |
| `research` | read, grep, find, ls, bash | Inherit | Deep research tasks |
| `writer` | read, write, edit, grep, find, ls | Inherit | Documentation creation |
| `debugger` | read, bash, grep, find, ls | Inherit | Systematic debugging |

## Spawning Sub-Agents

### Basic Spawn (Foreground)

```
Agent({
  subagent_type: "Explore",
  prompt: "Find all files related to authentication",
  description: "Find auth files"
})
```

### Background Spawn

```
Agent({
  subagent_type: "research",
  prompt: "Research competitor pricing for fintech apps",
  description: "Competitor research",
  run_in_background: true
})
```

### With Model Selection

```
Agent({
  subagent_type: "Explore",
  prompt: "Analyze the database schema",
  description: "DB schema analysis",
  model: "anthropic/claude-sonnet-4-6"
})
```

### With Custom Settings

```
Agent({
  subagent_type: "debugger",
  prompt: "Debug the login issue",
  description: "Login debugging",
  thinking: "high",
  max_turns: 30
})
```

## Managing Sub-Agents

### List Active Agents
```
/agents
```

### Get Results
```
get_subagent_result({ agent_id: "abc123" })
```

### Wait for Completion
```
get_subagent_result({ agent_id: "abc123", wait: true })
```

### Steering a Running Agent
```
steer_subagent({
  agent_id: "abc123",
  message: "Focus on the auth module instead"
})
```

## Best Practices

### Task Definition
- Be clear and specific in prompts
- Define success criteria
- Set appropriate max_turns

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

## Custom Agent Types

Create custom agents in `.pi/agents/<name>.md`:

```yaml
---
description: My Custom Agent
tools: read, bash, grep
model: inherit
thinking: medium
max_turns: 20
---

Your agent prompt goes here.
```

## Relationship to Other Modules

| Module | Sub-agent integration |
|--------|---------------------|
| Planning | Sub-agents can create plan files |
| Mission Control | Sub-agents update tickets |
| Mem0 | Sub-agents can store/recall memories |
| Browser | Sub-agents can do research |

## Configuration

Settings persist in:
- Global: `~/.pi/agent/subagents.json`
- Project: `<cwd>/.pi/subagents.json`

Configurable options:
- `maxConcurrent` - Max parallel agents (default: 4)
- `graceTurns` - Graceful shutdown turns (default: 5)
- Default max turns per agent type
- Join mode (smart/async/group)
