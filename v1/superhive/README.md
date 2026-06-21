# SuperHive — Host Extension

The orchestrator extension for managing a fleet of General V1 agents. SuperHive runs as a Pi Agent extension (monolithic) wrapped in an Electron desktop app.

## What It Does

- **WebSocket server** on `ws://127.0.0.1:7711` — accepts agent connections
- **Internal WebSocket client** to `ws://127.0.0.1:7712` — pushes events to Electron renderer
- **Agent registry** — tracks connected agents with manifests
- **Permission router** — receives permission requests, routes to UI, returns decisions
- **Settings engine** — validates and pushes module settings to agents
- **Inter-agent broker** — routes DM/broadcast/group messages between agents
- **Authority manager** — records and revokes authority grants
- **Presence tracker** — real-time agent status
- **State aggregator** — rollup metrics from all agents
- **JSON file persistence** in `~/.superhive/`

## Directory Structure

```
v1/superhive/
├── extensions/superhive/        # THE extension (monolithic)
│   ├── index.ts                  # Entry point + lifecycle
│   ├── config.ts                 # Config loader
│   ├── logger.ts                 # Structured logger
│   ├── types.ts                  # Shared TypeScript types
│   ├── server/
│   │   ├── websocket-server.ts    # Public WebSocket server
│   │   └── connection.ts          # Per-connection handler
│   ├── registry/
│   │   ├── agent-registry.ts     # Agent table
│   │   └── manifest-validator.ts # Schema validation
│   ├── settings/
│   │   └── settings-engine.ts     # Settings push + hash tracking
│   ├── permissions/
│   │   └── permission-router.ts   # Permission request queue
│   ├── messaging/
│   │   └── broker.ts              # DM / broadcast / group routing
│   ├── presence/
│   │   └── presence-tracker.ts    # Real-time presence
│   ├── authority/
│   │   └── authority-manager.ts   # Grant / revoke
│   ├── state/
│   │   └── state-aggregator.ts   # Metrics rollup
│   ├── auth/
│   │   └── api-key-store.ts       # API key registry
│   ├── ipc/
│   │   └── internal-client.ts     # WebSocket → renderer
│   └── persistence/
│       ├── store.ts               # JSON file store
│       └── paths.ts               # ~/.superhive/ layout
├── electron/                     # Electron desktop app
│   ├── main/main.ts              # App entry, Pi Agent spawn
│   ├── preload/preload.ts        # contextBridge API
│   └── renderer/                 # React SPA
│       ├── src/App.tsx           # Main UI
│       └── src/ws/client.ts     # Renderer WebSocket client
├── SKILL.md                      # Behavioral guidance
└── README.md                     # This file
```

## Running

### Development

```bash
cd electron
npm install
npm run dev
```

This starts:
1. Vite dev server for the renderer (port 5173)
2. Electron main process
3. Pi Agent with the superhive extension loaded
4. WebSocket server on port 7711

### Production

```bash
cd electron
npm run build
npm run package
```

Produces a packaged app in `out/`.

### Connecting an Agent

The General V1 `v1/communication/` module connects to SuperHive automatically when configured:

```json
// v1/communication/config.json
{
  "host": {
    "url": "ws://127.0.0.1:7711"
  }
}
```

## Configuration

Default config at `~/.superhive/config.json`:

```json
{
  "mode": "localhost",
  "publicHost": "127.0.0.1",
  "publicPort": 7711,
  "internalUrl": "ws://127.0.0.1:7712",
  "heartbeatIntervalMs": 15000,
  "heartbeatTimeoutMs": 30000,
  "dataDir": "~/.superhive",
  "log": { "level": "info", "pretty": true },
  "auth": { "required": false }
}
```

Override with environment variables:
- `SUPERHIVE_PUBLIC_PORT`
- `SUPERHIVE_INTERNAL_URL`
- `SUPERHIVE_MODE`
- `SUPERHIVE_LOG_LEVEL`

## Message Protocol

See `docs/PROTOCOL.md` for the full protocol reference.

Quick reference:

| Direction | Type | Purpose |
|-----------|------|---------|
| agent→host | `AGENT_HELLO` | Connect with manifest |
| host→agent | `HOST_WELCOME` | Accept connection |
| agent→host | `PERMISSION_REQUEST` | Request approval |
| host→agent | `PERMISSION_DECISION` | Approve/deny |
| host→agent | `SETTINGS_UPDATE` | Push settings |
| agent→host | `INTER_AGENT_MESSAGE` | Route message |
| host→agent | `INTER_AGENT_DELIVERY` | Deliver message |
| agent→host | `AUTHORITY_GRANT` | Grant authority |
| host→agent | `COMMAND` | reload/pause/resume |

## Persistence

All data in `~/.superhive/`:

```
~/.superhive/
├── config.json
├── agents.json
├── settings/<agentId>.json
├── permissions/<agentId>.json
├── messages/YYYY-MM-DD.jsonl
├── authority.json
├── audit/YYYY-MM-DD.jsonl
└── logs/YYYY-MM-DD.log
```

## Status

v1 scope: localhost, single-user, JSON persistence, no auth.
