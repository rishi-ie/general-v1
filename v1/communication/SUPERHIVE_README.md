# SuperHive — Host Side

The orchestrator that turns a swarm of Pi Agents into a coordinated system. SuperHive is a single Pi Agent extension wrapped in an Electron desktop app. It speaks WebSocket to remote agents and to its own renderer, and it owns the canonical state for the whole fleet.

This is the **host** counterpart of `v1/communication/` — the agent side. Read both READMEs together.

```
┌──────────────────────────────────────────────────────────────────┐
│                          SuperHive Host                          │
│                                                                  │
│   ┌──────────────────────────┐    internal ws   ┌──────────────┐  │
│   │   Pi Agent Process       │◀────────────────▶│  Electron    │  │
│   │   + SuperHive Extension  │  127.0.0.1:7712 │  Renderer    │  │
│   │                          │                  │  (UI)        │  │
│   │   - WebSocket SERVER     │                  │              │  │
│   │   - Agent registry       │                  │  React/Vue/  │  │
│   │   - Settings engine      │                  │  Svelte      │  │
│   │   - Permission router    │                  │              │  │
│   │   - Inter-agent broker   │                  └──────────────┘  │
│   │   - Presence tracker     │                                   │
│   │   - Authority manager     │                                   │
│   │   - Internal WS client   │                                   │
│   └──────────┬───────────────┘                                   │
│              │                                                  │
└──────────────┼──────────────────────────────────────────────────┘
               │ public ws — accepts agent connections
               │ ws://localhost:7711  or  wss://hive.example.com
               ▼
       ┌───────────────┐
       │  Pi Agent #1  │   v1/communication/  (agent side)
       │  Pi Agent #2  │   v1/communication/  (agent side)
       │  Pi Agent #N  │   v1/communication/  (agent side)
       └───────────────┘
```

---

## 1. Overview

### What It Is

SuperHive is **one** Pi Agent extension (monolithic) that:

1. Runs a **WebSocket server** that accepts connections from any number of agent-side Pi installations.
2. Runs an **internal WebSocket client** that pushes every event to the Electron renderer's UI.
3. Owns the canonical state: agents, settings, permissions, messages, authority grants, presence.
4. Exposes a control plane: approve/deny permissions, push settings, send messages, grant/revoke authority, kick agents.

### How It Relates to the Agent Side

| Concern | Agent side (`v1/communication/`) | Host side (SuperHive) |
|---|---|---|
| Process | Pi Agent, one per agent | Pi Agent + Electron, one per host |
| WebSocket role | **Client** (connects out) | **Server** (accepts in) + **internal client** |
| Direction of settings | Receives, validates, applies | Pushes, owns schema, validates |
| Direction of permissions | Requests, waits, acts | Receives, decides, replies |
| Inter-agent messages | Sends and receives | Brokers / relays |
| Presence | Reports its own | Aggregates from all |
| Authority | Grants to others, holds grants | Records and revokes |
| State | Streams its own | Aggregates and displays |

### Deployment Modes

| Mode | WebSocket bind | Renderer address | Use case |
|---|---|---|---|
| **Localhost** | `127.0.0.1:7711` | `ws://127.0.0.1:7712` | Single user, all agents on one machine |
| **Remote (self-hosted)** | `0.0.0.0:7711` (TLS) | `ws://127.0.0.1:7712` | SuperHive on a server, agents connect from anywhere |

v1 ships **localhost only**. Remote is wired but auth is deferred.

---

## 2. Directory Structure

```
v1/superhive/
├── README.md                          # this file
├── SKILL.md                           # behavioral guidance for the host agent
├── package.json                       # pi package manifest
├── config.json                        # default config (port, paths, mode)
├── schema.json                        # module manifest (Pi package schema)
│
├── extensions/
│   └── superhive/                     # THE extension — monolithic
│       ├── index.ts                   # lifecycle hooks (entry point)
│       ├── config.ts                  # config loader + defaults
│       ├── logger.ts                  # structured logger
│       ├── types.ts                   # all shared TypeScript types
│       │
│       ├── server/
│       │   ├── websocket-server.ts    # public WebSocket server
│       │   ├── connection.ts          # per-connection handler
│       │   └── envelope.ts            # frame encode/decode + IDs
│       │
│       ├── registry/
│       │   ├── agent-registry.ts      # in-memory agent table
│       │   └── manifest-validator.ts  # schema check on AGENT_HELLO
│       │
│       ├── settings/
│       │   └── settings-engine.ts     # diff, apply, hash tracking
│       │
│       ├── permissions/
│       │   └── permission-router.ts   # collects requests, dispatches decisions
│       │
│       ├── messaging/
│       │   └── broker.ts              # DM, broadcast, group router
│       │
│       ├── presence/
│       │   └── presence-tracker.ts     # online/away/busy aggregation
│       │
│       ├── authority/
│       │   └── authority-manager.ts   # grant/revoke registry
│       │
│       ├── state/
│       │   └── state-aggregator.ts    # merges agent states
│       │
│       ├── auth/
│       │   └── api-key-store.ts       # local API key registry
│       │
│       ├── ipc/
│       │   └── internal-client.ts     # WebSocket client → renderer
│       │
│       └── persistence/
│           ├── store.ts               # JSON file store (v1)
│           └── paths.ts               # ~/.superhive/ layout
│
├── electron/
│   ├── package.json
│   ├── forge.config.js
│   ├── vite.main.config.ts
│   ├── vite.preload.config.ts
│   ├── vite.renderer.config.ts
│   ├── tsconfig.json
│   │
│   ├── main/
│   │   └── main.ts                    # app entry, window creation, Pi Agent spawn
│   │
│   ├── preload/
│   │   └── preload.ts                 # contextBridge exposing safe API
│   │
│   └── renderer/                      # React SPA (or Vue/Svelte)
│       ├── package.json
│       ├── vite.config.ts
│       ├── index.html
│       └── src/
│           ├── main.tsx
│           ├── App.tsx                # Main UI with tabs
│           ├── types.d.ts
│           ├── store/                 # Zustand store
│           │   └── index.ts
│           ├── ws/
│           │   └── client.ts          # connects to internal renderer server
│           └── components/           # per-tab components
│
└── docs/
    └── PROTOCOL.md                    # full protocol reference
```

---

## 3. The WebSocket Protocol

All frames are JSON text messages. One frame = one logical message.

### 3.1 Envelope

Every frame uses this envelope:

```typescript
interface Envelope<T = unknown> {
  v: 1;                          // protocol version
  type: string;                  // see message tables below
  id: string;                    // ULID/UUIDv7, unique per message
  ts: number;                    // unix ms
  corr?: string;                 // correlation id (for request/response)
  from?: string;                 // agentId or "host"
  to?: string;                   // agentId, groupId, or "*"
  payload: T;                    // type-specific body
}
```

The host validates `v === 1` on every inbound frame. Anything else closes the connection with code `4400`.

### 3.2 Connection Lifecycle

```
Agent                              Host
  |                                  |
  |--- WS Upgrade ------------------▶|
  |                                  |
  |<-- 101 Switching Protocols ------|
  |                                  |
  |--- AGENT_HELLO (manifest) ------▶|
  |                                  |--- validate manifest
  |<-- HOST_WELCOME (agentId) ------|
  |                                  |
  |--- HEARTBEAT (every 15s) ------▶|
  |<-- HEARTBEAT_ACK ---------------|
  |                                  |
  |--- AGENT_STATE / etc. --------▶|
  |                                  |
  |<-- SETTINGS_UPDATE ------------|
  |--- SETTINGS_APPLIED ---------->|
  |                                  |
  |--- WS Close -------------------▶|
```

### 3.3 Agent → Host Messages

| `type` | Payload | Purpose |
|---|---|---|
| `AGENT_HELLO` | `{ manifest: AgentManifest, version: string, capabilities: string[] }` | First message after connect. Required. |
| `AGENT_STATE` | `{ state: AgentState, metrics?: Metrics }` | Periodic state push. |
| `PERMISSION_REQUEST` | `{ requestId, tool, args, reason, severity }` | Agent is blocked on a decision. |
| `INTER_AGENT_MESSAGE` | `{ messageId, to?, group?, broadcast?, kind, payload }` | Outbound message from this agent. |
| `AUTHORITY_GRANT` | `{ grantId, toAgentId, scope, expiresAt? }` | Agent grants authority to a peer. |
| `AUTHORITY_REVOKE` | `{ grantId }` | Agent revokes a previously granted authority. |
| `PRESENCE_UPDATE` | `{ status, activity? }` | Voluntary presence change. |
| `SETTINGS_APPLIED` | `{ settingsHash }` | Ack of a settings push. |
| `SETTINGS_REJECTED` | `{ settingsHash, reason, errors }` | Agent could not apply. |
| `HEARTBEAT` | `{ agentId, ts, pingToken }` | Keepalive. Every 15s. |
| `DISCONNECT` | `{ reason }` | Graceful close notice. |

### 3.4 Host → Agent Messages

| `type` | Payload | Purpose |
|---|---|---|
| `HOST_WELCOME` | `{ agentId, sessionId, serverVersion, heartbeatIntervalMs }` | Reply to AGENT_HELLO. |
| `SETTINGS_UPDATE` | `{ patch, expectedHash, schema, urgent }` | Push new settings. |
| `PERMISSION_DECISION` | `{ requestId, decision, reason?, remember? }` | Resolution of a pending request. |
| `INTER_AGENT_DELIVERY` | `{ from, messageId, kind, payload, receivedAt }` | Incoming message from another agent. |
| `AUTHORITY_REVOKED` | `{ grantId, reason }` | Host revokes a grant. |
| `PRESENCE_SNAPSHOT` | `{ agents: PresenceEntry[] }` | Full presence picture. |
| `COMMAND` | `{ command: 'reload'|'restart'|'pause'|'resume', args? }` | Operational control. |
| `HEARTBEAT_ACK` | `{ ts, pongToken }` | Reply to HEARTBEAT. |
| `KICK` | `{ reason }` | Disconnect this agent. |

### 3.5 Internal Host ↔ Renderer Messages

The Electron renderer connects to `ws://127.0.0.1:7712` as a WebSocket client. It uses the same envelope but a different set of `type` values. These are NOT sent on the public port.

**Host → Renderer:**

| `type` | Payload |
|---|---|
| `AGENT_CONNECTED` | `{ agent: AgentRecord }` |
| `AGENT_DISCONNECTED` | `{ agentId, reason }` |
| `AGENT_STATE_CHANGED` | `{ agentId, state, metrics? }` |
| `PERMISSION_REQUESTED` | `{ agentId, request }` |
| `PERMISSION_RESOLVED` | `{ agentId, requestId, decision }` |
| `INTER_AGENT_DELIVERY` | `{ message }` |
| `AUTHORITY_CHANGED` | `{ change: 'granted'|'revoked', grant }` |
| `PRESENCE_CHANGED` | `{ snapshot: PresenceEntry[] }` |
| `SETTINGS_PUSH_RESULT` | `{ agentId, ok, errors? }` |
| `AUDIT_EVENT` | `{ event: AuditEvent }` |
| `LOG` | `{ level, source, message, meta? }` |
| `INITIAL_SNAPSHOT` | `{ agents, settings, permissions, messages, authority, presence }` |

**Renderer → Host:**

| `type` | Payload |
|---|---|
| `LIST_AGENTS` | `{}` |
| `APPROVE_PERMISSION` | `{ requestId, remember? }` |
| `DENY_PERMISSION` | `{ requestId, reason? }` |
| `PUSH_SETTINGS` | `{ agentId, patch, expectedHash? }` |
| `SEND_MESSAGE` | `{ from, to?, group?, broadcast?, kind, payload }` |
| `REVOKE_AUTHORITY` | `{ grantId }` |
| `KICK_AGENT` | `{ agentId, reason? }` |
| `SEND_COMMAND` | `{ agentId, command, args? }` |

---

## 4. Core Subsystems

### 4.1 WebSocket Server (`server/`)

- Binds to `127.0.0.1:7711` (localhost mode)
- Per-connection handler with heartbeat (15s ping, 30s timeout)
- Frame validation (version check, JSON parse, schema)
- Rate limiting (100 msg/s per connection, configurable)
- Graceful close with code + reason

### 4.2 Agent Registry (`registry/`)

- In-memory table of `AgentRecord`
- Manifest validation on connect (schema check, version format)
- Connection ↔ agentId mapping
- Persistence to `agents.json` on every change
- Restoration on startup

### 4.3 Settings Engine (`settings/`)

- Receives JSON Patch from renderer
- Validates patch against agent's own `settingsSchema` (from manifest)
- Hash tracking for optimistic concurrency
- Applies patch, persists to `settings/<agentId>.json`
- Emits `SETTINGS_APPLIED` ack to agent

### 4.4 Permission Router (`permissions/`)

- Enqueues `PendingRequest` on each `PERMISSION_REQUEST`
- Emits to renderer for display in Permission Inbox
- Resolves with `PERMISSION_DECISION` on user approve/deny
- Optional default policies per tool (allow/deny/ask)
- Stale request cleanup (configurable timeout)

### 4.5 Inter-Agent Broker (`messaging/`)

- **DM**: `to` field → direct delivery to agent connection
- **Broadcast**: `broadcast: true` → delivery to all online agents except sender
- **Group**: `group` field → delivery to all members of that group
- Message history persisted to `messages/YYYY-MM-DD.jsonl`
- Join/leave group management

### 4.6 Presence Tracker (`presence/`)

- Tracks `online/away/busy/offline` per agent
- Diffed snapshots sent to renderer on change
- Derived from registry `agent:connected`, `agent:disconnected`, `agent:updated` events

### 4.7 Authority Manager (`authority/`)

- Records `AuthorityGrant` with grantId, from, to, scope, expiry
- Persisted to `authority.json`
- Revocation with reason + timestamp
- Revokes all grants involving an agent on disconnect
- Scope satisfaction check for authorization decisions

### 4.8 Internal WebSocket Client (`ipc/`)

- Connects to `ws://127.0.0.1:7712`
- Auto-reconnect with exponential backoff (max 30s)
- Request/response correlation via correlation IDs
- All host→renderer traffic goes through here

### 4.9 Persistence (`persistence/`)

- `~/.superhive/` data root
- Atomic writes (write `.tmp`, rename)
- Append-only logs for messages and audit
- JSON file store with read/write/append
- Subdirectories auto-created

---

## 5. The Electron App

### 5.1 Architecture

```
┌────────────────────────────────────────────────────────────┐
│                       Electron App                         │
│                                                            │
│  ┌──────────────┐    child_process.spawn   ┌───────────┐  │
│  │  Main        │─────────────────────────▶│  Pi Agent │  │
│  │  Process     │◀──── stdio (logs) ────────│  Process  │  │
│  │              │                          │           │  │
│  │  - Window    │                          │  + Ext    │  │
│  │  - Tray      │                          │           │  │
│  │  - Renderer- │◀───── internal ws ───────┘           │  │
│  │    Server    │  ws://127.0.0.1:7712                   │  │
│  └──────┬───────┘                                       │  │
│         │ contextBridge IPC                              │  │
│  ┌──────▼───────┐                                       │  │
│  │  Preload     │                                       │  │
│  │  (sandbox)   │                                       │  │
│  └──────┬───────┘                                       │  │
│         │                                                │  │
│  ┌──────▼───────┐                                       │  │
│  │  Renderer    │  React SPA                           │  │
│  │  (UI)        │  - Zustand store                     │  │
│  └──────────────┘  - ws client → renderer server        │  │
└────────────────────────────────────────────────────────────┘
```

### 5.2 Main Process Responsibilities

- Spawns Pi Agent as child process with `SUPERHIVE_*` env vars
- Starts internal WebSocket server (port 7712) for renderer
- Pipes stdout/stderr from agent to console
- Handles IPC from renderer (`superhive:out`) → forwards to renderer WS clients
- Handles `agent:exited` → shows notification, optionally restarts
- Manages window lifecycle, menu, tray

### 5.3 Preload API

```typescript
// renderer
window.superhive.send({ type: 'APPROVE_PERMISSION', payload: { requestId: '...' } });
const unsub = window.superhive.on((msg) => { /* host → renderer messages */ });
```

### 5.4 Renderer State (Zustand)

```typescript
interface Store {
  agents: AgentRecord[];
  pendingPermissions: PendingRequest[];
  authority: AuthorityGrant[];
  presence: PresenceEntry[];
  messages: InterAgentMessage[];
  connected: boolean;
  // ... setters
}
```

### 5.5 UI Tabs

| Tab | Component | Data |
|-----|-----------|------|
| Agents | `AgentCard[]` | `agents` |
| Permissions | `PermissionCard[]` | `pendingPermissions` |
| Chat | `ChatPanel` | `messages`, compose |
| Presence | `PresenceBoard` | `presence` |
| Authority | `AuthorityPanel` | `authority` |

---

## 6. Schema Validation

The host stores each agent's `settingsSchema` (sent in the manifest). When the user edits a setting:

1. **Validates against the agent's schema** (host-side check with `ajv`)
2. **Sends to the agent** as a JSON Patch (`SETTINGS_UPDATE`)
3. **Agent re-validates and applies** — agent's `settings-store.ts` is authoritative
4. **Agent acks** via `SETTINGS_APPLIED` or `SETTINGS_REJECTED`

```typescript
// settings-engine.ts
const valid = ajv.compile(agent.manifest.settingsSchema);
if (!valid(next)) throw new SettingsValidationError(valid.errors);
```

---

## 7. Authentication

**v1: local only. Details deferred.**

For localhost mode, the host binds to `127.0.0.1` and accepts any local connection. No API key required.

For remote mode (wired but not implemented in v1):

1. On first start, generate an API key → `~/.superhive/host.key`
2. Expose key in UI ("Show my API key")
3. User provisions key into agent's `config.json`
4. On `AGENT_HELLO`, check `Authorization: Bearer <key>` header

The protocol adds `AUTH_REQUIRED` / `AUTH` message pair — not implemented in v1.

**Out of scope for v1:** per-agent keys, key rotation, OAuth, mTLS, multi-user accounts.

---

## 8. Persistence Layout

`~/.superhive/` is the data root. JSON files, written atomically (write to `.tmp`, rename).

```
~/.superhive/
├── config.json                 # host config (port, mode, etc.)
├── host.key                    # API key (remote mode only)
├── agents.json                 # last-known agent registry
├── settings/
│   └── <agentId>.json         # last-pushed settings per agent
├── permissions/
│   └── <agentId>.json         # remembered decisions
├── messages/
│   └── <YYYY-MM-DD>.jsonl     # append-only daily log of inter-agent messages
├── authority.json              # all grants, active and revoked
├── presence-snapshot.json      # last seen state (informational)
├── audit/
│   └── <YYYY-MM-DD>.jsonl     # append-only daily log of all host actions
└── logs/
    └── <YYYY-MM-DD>.log       # extension stdout/stderr
```

---

## 9. Localhost vs Remote Config

```json
// ~/.superhive/config.json
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

| Aspect | Localhost | Remote |
|---|---|---|
| Bind address | `127.0.0.1` | `0.0.0.0` |
| TLS | none | required |
| Auth | none | API key (deferred) |
| Agent URL | `ws://localhost:7711` | `wss://hive.example.com:7711` |

---

## 10. Implementation Order

1. **`server/websocket-server.ts` + `connection.ts` + `envelope.ts`**
   - Smoke test: connect with `wscat`, send a frame, see it logged.
2. **`registry/agent-registry.ts` + `manifest-validator.ts`**
   - Test: send `AGENT_HELLO` with bad manifest, see `4400` close.
3. **`persistence/store.ts` + `paths.ts`**
   - Test: kill host, restart, see prior agents restored.
4. **`ipc/internal-client.ts` + `electron/main/renderer-server.ts` + `preload.ts`**
   - Test: blank Electron window, console.log every envelope that arrives.
5. **`AgentWorkspace` component**
   - Test: connect an agent, see it appear in the list with its manifest.
6. **Settings engine + `SettingsPanel`**
   - Test: edit a setting, see it pushed, see `SETTINGS_APPLIED` arrive.
7. **Permission router + `PermissionInbox`**
   - Test: trigger a permission request from agent, see it in inbox, approve it.
8. **Inter-agent broker + `Chat`**
   - Test: send a DM from one agent, see it delivered to the other.
9. **Presence tracker + `PresenceBoard`**
   - Test: disconnect an agent, see presence update.
10. **Authority manager + `AuthorityManager` UI**
    - Test: agent A grants to B, see it in manager, revoke it.
11. **State aggregator + metrics rollups**
    - Test: multiple agents streaming state, see rollups in UI.
12. **Audit log**
    - Test: every host action shows up in `audit/YYYY-MM-DD.jsonl`.
13. **Packaging** (electron-forge)
    - Test: produce a `.dmg` / `.exe` / `.AppImage` that launches end-to-end.

---

## 11. Status

v1 scope: **localhost, single-user, JSON persistence, no auth.**

Out of scope (v2+): remote mode, multi-user, SQLite/Postgres, per-agent keys, OAuth, file transfer, etc.
