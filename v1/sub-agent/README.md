# Sub-Agent Module

Spawn and manage sub-agents for parallel or specialized task execution, powered by [@tintinweb/pi-subagents](https://github.com/tintinweb/pi-subagents).

## What It Does

Sub-agents run in isolated sessions — each with its own tools, system prompt, model, and thinking level. Run them in foreground or background, steer them mid-run, and collect results when complete.

## Installation

This module clones `@tintinweb/pi-subagents` directly into `v1/sub-agent/src/`. No npm install needed.

To use, load the extension in meta-agent:

```bash
pi -e ./v1/sub-agent/src/index.ts
```

Or via config in `meta-agent-config/config.json`:

```json
{
  "extensions": [
    "extensions/planning-with-files",
    "v1/sub-agent/src/index.ts"
  ]
}
```

## Default Agent Types

| Type | Description | Tools | Model |
|------|-------------|-------|-------|
| `general-purpose` | Parent twin — inherits parent prompt | All | Inherit |
| `Explore` | Fast read-only search | read, bash, grep, find, ls | haiku |
| `Plan` | Software architecture planning | read, bash, grep, find, ls | Inherit |

## Custom Agent Types (General V1)

| Type | Description |
|------|-------------|
| `research` | Deep research specialist |
| `writer` | Technical documentation |
| `debugger` | Systematic debugging |

## Commands

| Command | Description |
|---------|-------------|
| `/agents` | Interactive agent management |

## Tools

| Tool | Description |
|------|-------------|
| `Agent` | Spawn a sub-agent |
| `get_subagent_result` | Retrieve results |
| `steer_subagent` | Redirect a running agent |

## Spawning Sub-Agents

### Foreground (blocks until complete)
```
Agent({
  subagent_type: "Explore",
  prompt: "Find auth files",
  description: "Find auth"
})
```

### Background (returns ID immediately)
```
Agent({
  subagent_type: "research",
  prompt: "Research competitor pricing",
  description: "Competitor research",
  run_in_background: true
})
```

## Configuration

Settings file locations:
- Global: `~/.pi/agent/subagents.json`
- Project: `<cwd>/.pi/subagents.json`

Options:
- `maxConcurrent` - Max parallel agents (default: 4)
- `graceTurns` - Graceful shutdown turns (default: 5)
- Default max turns per agent type
- Join mode: `smart` (default), `async`, `group`

## Custom Agents

Create custom agents in `v1/sub-agent/src/.pi/agents/<name>.md`:

```yaml
---
description: My Agent
tools: read, bash
model: inherit
thinking: medium
max_turns: 20
---

Your agent prompt here.
```

## Key Features

- **Parallel execution** — Multiple agents run concurrently
- **Live widget** — Persistent UI showing agent status
- **Mid-run steering** — Redirect agents without restarting
- **Graceful limits** — Agents wrap up cleanly at turn limits
- **Context inheritance** — Optionally fork parent conversation
- **Worktree isolation** — Run in isolated git copies
- **Skill preloading** — Inject skills into agent prompts

## Related Modules

| Module | Integration |
|--------|------------|
| Planning | Agents create plan files |
| Mission Control | Agents update tickets |
| Mem0 | Agents store memories |
| Browser | Agents do research |
