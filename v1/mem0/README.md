# Mem0 Memory Module

Persistent semantic memory for General V1, powered by [Mem0](https://mem0.ai).

## What It Does

Mem0 gives the digital employee long-term memory that persists across sessions. It automatically learns from conversations and can be queried at any time. This enables the agent to:

- Remember user preferences and working style
- Track decisions and their rationale
- Maintain context across sessions without manual restoration
- Build on past work without relearning what's already known

## Setup

### 1. Get an API Key

Sign up at [app.mem0.ai](https://app.mem0.ai/dashboard/api-keys) and copy your API key.

### 2. Configure

Create `~/.pi/agent/mem0-config.json` with your settings:

```json
{
  "apiKey": "m0-your-key-here",
  "userId": "your-username",
  "autoCapture": true,
  "defaultScope": "project",
  "searchThreshold": 0.25,
  "dream": {
    "enabled": true,
    "auto": true,
    "minHours": 24,
    "minSessions": 5,
    "minMemories": 15
  }
}
```

Or set environment variables:

```bash
export MEM0_API_KEY="m0-your-key-here"
export MEM0_USER_ID="your-username"
```

### 3. Install

The Mem0 plugin is installed as a Pi Agent package:

```bash
pi install npm:@mem0/pi-agent-plugin
```

This is handled automatically by `run.sh` if configured.

## Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `apiKey` | required | Your Mem0 API key |
| `userId` | required | Identifier for the user |
| `autoCapture` | `true` | Automatically learn from conversations |
| `defaultScope` | `project` | Default scope: `project`, `session`, or `global` |
| `searchThreshold` | `0.25` | Minimum similarity for search results (0-1) |

### Dream Settings

Dream consolidation settings control when memories are automatically pruned and merged:

| Option | Default | Description |
|--------|---------|-------------|
| `enabled` | `true` | Enable dream consolidation |
| `auto` | `true` | Run automatically when conditions are met |
| `minHours` | `24` | Minimum hours between consolidation |
| `minSessions` | `5` | Minimum sessions before consolidation |
| `minMemories` | `15` | Minimum memories before consolidation |

## Memory Scopes

| Scope | What it covers |
|-------|----------------|
| `project` | Current git repository (default) |
| `session` | Current session only |
| `global` | All projects |

Project scope uses git root to detect the repository, so all subdirectories in a monorepo share the same memory pool.

## Quick Reference

| Command | Description |
|---------|-------------|
| `/mem0-remember <text>` | Store a memory verbatim |
| `/mem0-search <query>` | Search memories |
| `/mem0-tour [scope]` | Browse all memories |
| `/mem0-forget <query>` | Delete matching memories |
| `/mem0-dream` | Consolidate memories |
| `/mem0-status` | Check memory health |

## Integration with General V1

Mem0 is one of the core modules that makes General V1 a "smart" employee. It works alongside:

- **Planning** — Mem0 stores context; planning tracks work
- **Mission Control** — Mission control tracks tasks; Mem0 stores why decisions were made
- **Identity** — Identity defines who the agent is; Mem0 remembers what the agent knows about the user

## See Also

- [Mem0 Documentation](https://docs.mem0.ai)
- [@mem0/pi-agent-plugin](https://github.com/mem0ai/mem0/tree/main/integrations/pi-agent-plugin)
