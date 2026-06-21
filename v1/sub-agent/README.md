# Sub-Agent Module

Spawn and manage sub-agents for parallel or specialized task execution. Built on [pi-subagents](https://github.com/nicobailon/pi-subagents) by nicobailon.

## What It Does

Sub-agents run in isolated sessions — each with its own tools, system prompt, model, and thinking level. Run them in foreground or background, chain them in pipelines, or parallelize independent work.

## Installation

pi-subagents is copied directly into `v1/sub-agent/src/`. No npm install needed.

To use, load the extension via meta-agent config:

```bash
pi -e ./v1/sub-agent/src/src/extension/index.ts
```

Or via config in `meta-agent-config/config.json`:

```json
{
  "extensions": [
    "v1/sub-agent/src/src/extension/index.ts"
  ]
}
```

## Builtin Agents (pi-subagents)

| Agent | Description | Tools |
|-------|-------------|-------|
| `scout` | Fast codebase recon | read, bash, grep, find, ls |
| `researcher` | Web/docs research with sources | web_search, fetch_content |
| `planner` | Concrete implementation plans | read, bash, grep, find, ls |
| `worker` | Implementation (needs approval) | read, bash, grep, find, ls, edit |
| `reviewer` | Code review and validation | read, bash, grep, find, ls, edit |
| `oracle` | Second opinion, challenge assumptions | read, bash, grep, find, ls |
| `delegate` | General parent twin | All tools |
| `context-builder` | Setup pass before planning | read, write |

## General V1 Custom Agents

| Agent | Description |
|-------|-------------|
| `research` | Deep research with synthesis |
| `writer` | Technical documentation |
| `debugger` | Systematic root cause analysis |
| `auditor` | Security and quality audit |

## Usage

### Natural Language (Recommended)

```
Use reviewer to review this diff.
Ask oracle for a second opinion on my current plan.
Run parallel reviewers: one for correctness, one for tests.
Have worker implement this approved plan.
Use scout to understand this codebase.
```

### Slash Commands

```
/run reviewer "Review this diff"
/chain scout "scan code" -> planner "create plan"
/parallel scout "scan frontend" -> scout "scan backend"
/run researcher "Research X" --bg
```

### Programmatic

```javascript
// Single
subagent({ agent: "worker", task: "refactor auth" })

// Parallel
subagent({ tasks: [{ agent: "scout", task: "scan frontend" }, { agent: "reviewer", task: "review backend" }] })

// Chain
subagent({ chain: [{ agent: "scout", task: "Gather context" }, { agent: "planner" }, { agent: "worker" }] })

// Background
subagent({ agent: "research", task: "Research pricing", async: true })
```

## Configuration

File: `v1/sub-agent/config.json`

```json
{
  "maxConcurrent": 4,
  "defaultContext": "fork",
  "asyncByDefault": false,
  "maxSubagentDepth": 1,
  "agentDefaults": {
    "research": { "model": "inherit", "thinking": "high" },
    "writer": { "model": "inherit", "thinking": "medium" },
    "debugger": { "model": "inherit", "thinking": "high" },
    "auditor": { "model": "inherit", "thinking": "high" }
  }
}
```

## Key Features

- **Parallel execution** — Multiple agents run concurrently (configurable max)
- **Chain workflows** — Sequential pipelines with data passing between steps
- **Background runs** — Detached execution with status tracking
- **Context modes** — fork (from parent context) or fresh (clean slate)
- **Clarify UI** — Preview and edit workflows before running
- **Custom agents** — Create agents in `src/agents/<name>.md`

## Custom Agents

Create custom agents in `v1/sub-agent/src/agents/<name>.md`:

```yaml
---
name: my-agent
description: My custom agent
tools: read, bash, grep
model: inherit
thinking: medium
---

Your system prompt here.
```

## Related Modules

| Module | Integration |
|--------|------------|
| Planning | Planner agent creates plan files |
| Mission Control | Agents update tickets |
| Mem0 | Agents store memories |
| Browser | Researcher agent does web research |
| Communication | Status streams to SuperHive |
| Permission | Delegation gated by permission/ |
