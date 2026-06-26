# Communication Module (Agent Side)

The **SuperHive bridge** — connects General V1 to the SuperHive host orchestrator. This is the counterpart to [`SUPERHIVE_README.md`](./SUPERHIVE_README.md) (the host side).

## What It Does

- **WebSocket client** — connects to SuperHive at `ws://127.0.0.1:7711`
- **Manifest registration** — announces identity, capabilities, and settings schema on connect
- **Permission requests** — blocks and waits for SuperHive approval on sensitive actions
- **Settings sync** — receives and applies JSON Patch settings from SuperHive
- **Inter-agent messaging** — sends and receives DM/broadcast/group messages via SuperHive
- **Authority grants** — grants and revokes authority to other agents
- **Presence reporting** — reports online/away/busy status to SuperHive
- **State streaming** — pushes current task and metrics to SuperHive every 30s

## Installation

Load as a Pi Agent extension:

```bash
pi --extension ./v1/communication/extensions/communication/index.ts
```

Or via config in `meta-agent-config/config.json`:

```json
{
  "extensions": [
    "v1/communication/extensions/communication/index.ts"
  ]
}
```

## Configuration

`~/.general-v1/communication/config.json`:

```json
{
  "host": {
    "url": "ws://127.0.0.1:7711",
    "apiKey": ""
  },
  "reconnect": {
    "maxAttempts": -1,
    "backoffMs": [500, 1000, 5000, 30000]
  },
  "heartbeatIntervalMs": 15000,
  "permissions": {
    "requireSuperhiveApproval": [
      "file_delete",
      "command_execute",
      "sub_agent_spawn",
      "network_request"
    ]
  }
}
```

## Module Manifest

`~/.general-v1/communication/schema.json` — sent to SuperHive on connect:

```json
{
  "name": "communication",
  "version": "0.1.0",
  "capabilities": ["websocket-client", "superhive-bridge", "inter-agent-messaging"],
  "settingsSchema": { ... },
  "interAgent": {
    "acceptsDMs": true,
    "acceptsBroadcasts": true,
    "groups": ["general", "software", "research"]
  }
}
```

## Programmatic API

```typescript
import { requestPermission, sendInterAgentMessage, grantAuthority, updatePresence, updateState } from './extensions/communication/index.ts';

// Request SuperHive approval for an action
const decision = await requestPermission('file_delete', { path: '/tmp/cache' }, 'Deleting stale cache', 'medium');

// Send a DM to another agent
sendInterAgentMessage('agent-xyz', false, undefined, 'text', 'Here is the auth module data');

// Broadcast to all agents
sendInterAgentMessage(undefined, true, undefined, 'event', { type: 'task_complete', task: 'auth' });

// Grant authority to another agent
grantAuthority('agent-xyz', { tools: ['read', 'bash'], paths: ['/tmp/shared'] });

// Update presence
updatePresence('busy', 'Implementing authentication module');

// Stream state to SuperHive
updateState({ currentTask: 'Building auth', phase: 'implementation' }, { tokensUsed: 45000, toolCalls: 23 });
```

## Connection Lifecycle

```
session_start
  └→ Connect WebSocket
  └→ Send AGENT_HELLO with manifest
  └→ Receive HOST_WELCOME → registered as agentId
  └→ Receive PRESENCE_SNAPSHOT of other agents

(session active)
  ├→ Send HEARTBEAT every 15s
  ├→ Send AGENT_STATE every 30s
  ├→ Receive SETTINGS_UPDATE → apply patch
  ├→ Receive PERMISSION_DECISION → unblock caller
  ├→ Receive INTER_AGENT_DELIVERY → deliver to handler
  └→ Receive COMMAND → execute locally

session_end
  └→ Send DISCONNECT
  └→ Close WebSocket gracefully
```

## Disconnection Behavior

If connection to SuperHive is lost:
- WebSocket auto-reconnects with exponential backoff (max 30s)
- All `requestPermission()` calls timeout and return `deny`
- `sendInterAgentMessage()` drops messages
- `updateState()` and `updatePresence()` have no effect
- Agent continues working locally

This is the intended behavior — agent operates normally but permission requests fail closed.

## Integration with Other Modules

| Module | Integration |
|--------|-------------|
| `permission/` | Routes sensitive requests through `requestPermission()` |
| `sub-agent/` | Reports sub-agent status via `updateState()` |
| `mission-control/` | Tickets visible in SuperHive UI |
| `planning/` | Current phase/task streamed to SuperHive |

## Related

- [`SUPERHIVE_README.md`](./SUPERHIVE_README.md) — Host side (SuperHive) implementation guide
- [`v1/superhive/`](../../superhive/) — SuperHive extension (host side)
