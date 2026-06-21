# Communication Module — Architecture

**Version**: 1.0.0
**Scope**: System design, data flow, and interaction patterns

---

## 1. High-Level Architecture

The communication module connects a single **General V1 agent** to a **SuperHive host**, forming a star topology:

```
                         ┌─────────────────────────────────────┐
                         │           SuperHive Host             │
                         │   (Electron + Pi Agent Extension)   │
                         │                                     │
                         │  ┌───────────────────────────────┐  │
                         │  │  WebSocket Server (:7711)     │  │
                         │  │  - Agent registry             │  │
                         │  │  - Permission router          │  │
                         │  │  - Settings engine            │  │
                         │  │  - Inter-agent broker        │  │
                         │  │  - Authority manager          │  │
                         │  └───────────────────────────────┘  │
                         │                 │                   │
                         │  ┌───────────────────────────────┐  │
                         │  │  Internal WS Client (:7712)   │  │
                         │  │  → Electron Renderer (UI)     │  │
                         │  └───────────────────────────────┘  │
                         └─────────────────┬───────────────────┘
                                           │ WebSocket
                         ┌─────────────────┴─────────────────┐
                         │         General V1 Agent            │
                         │         (Pi Agent + Extensions)     │
                         │                                       │
                         │  ┌───────────────────────────────┐  │
                         │  │  v1/communication/             │  │
                         │  │  - WebSocket client           │  │
                         │  │  - Settings store             │  │
                         │  │  - Permission bridge         │  │
                         │  │  - Message handlers          │  │
                         │  └───────────────────────────────┘  │
                         │                 │                   │
                         │  ┌───────────────┴───────────────┐  │
                         │  │  Other v1 modules:           │  │
                         │  │  permission/, sub-agent/,    │  │
                         │  │  mem0/, planning/, etc.     │  │
                         │  └───────────────────────────────┘  │
                         └─────────────────────────────────────┘
```

### 1.1 Two-Sided Nature

This module exists on **both sides** of the connection:

| Aspect | Agent Side | Host Side (SuperHive) |
|--------|------------|----------------------|
| Location | `v1/communication/` | `v1/superhive/` |
| Process | Pi Agent (one per agent) | Pi Agent + Electron (one per host) |
| WebSocket | Client (connects out) | Server (accepts in) |
| Direction | Outbound to host | Inbound from agents |
| Trust model | Connects to known host | Accepts any local connection |

### 1.2 Communication Is the "Mother Module"

As the user described, this module is the **central nervous system** of General V1:

1. **SuperHive controls all other modules** — settings for permission/, sub-agent/, mem0/, etc. are pushed through this module
2. **All permission grants flow through here** — the local `permission/` module is overridden by SuperHive for sensitive actions
3. **Real-time visibility** — everything happening in the agent is streamed to SuperHive
4. **Background approval** — user approves in SuperHive UI; agent proceeds without blocking

---

## 2. Component Architecture (Agent Side)

The agent-side implementation has these components:

```
v1/communication/extensions/communication/
├── index.ts              # Main extension entry + lifecycle
│   ├── Registers pi.on('session_start/end') handlers
│   ├── Wires up all subsystems
│   └── Handles incoming message routing
│
├── websocket.ts          # WebSocket client
│   ├── Manages TCP connection lifecycle
│   ├── Handles reconnection with backoff
│   ├── Implements heartbeat
│   └── Sends/receives frames
│
├── settings-store.ts     # Settings persistence + JSON Patch
│   ├── Loads/stores settings to ~/.general-v1/communication/
│   ├── Applies JSON Patch operations
│   └── Computes SHA-256 settings hash
│
├── types.ts              # TypeScript interfaces
│   ├── Envelope<T>
│   ├── AgentManifest
│   ├── AgentState
│   ├── InterAgentMessage
│   └── All payload types
│
└── envelope.ts           # ID generation
    └── generateId() — ULID-style IDs
```

---

## 3. Data Flow Diagrams

### 3.1 Connection Establishment

```
Agent Process Start
        │
        ▼
Load config from ~/.general-v1/communication/config.json
        │
        ▼
Create WebSocket to ws://host:7711
        │
        ▼
On WS open ────────► Send AGENT_HELLO (manifest)
        │
        ▼
Wait for HOST_WELCOME
        │
        ├── Valid manifest ──► Register agentId
        │                          │
        │                          ▼
        │                     connected = true
        │                          │
        │                          ▼
        │                     Start heartbeat timer
        │                          │
        │                          ▼
        │                     Start state stream timer
        │                          │
        └── Invalid ──► Close WS ──► Reconnect (backoff)
```

### 3.2 Permission Request Flow

```
Agent wants to do sensitive action
        │
        ▼
Call requestPermission(tool, args, reason, severity)
        │
        ▼
Generate requestId
        │
        ▼
Create pending entry { requestId, resolve, timeout }
        │
        ▼
Send PERMISSION_REQUEST to host
        │
        ▼
Start timeout timer (severity-based)
        │
        ▼
       ┌────────────────────────────┐
       │      WAIT FOR DECISION     │
       └────────────────────────────┘
        │                    │
        │ PERMISSION_DECISION   │ timeout
        ▼                    ▼
  Call resolve()         Call resolve({deny, timeout})
        │                    │
        └────────┬───────────┘
                 ▼
          Return to caller
          (allow or deny)
```

### 3.3 Settings Push Flow

```
SuperHive UI → Push Settings
        │
        ▼
Host sends SETTINGS_UPDATE (JSON Patch)
        │
        ▼
Agent receives in websocket.on('message')
        │
        ▼
Validate patch operations against schema
        │
        ├── Valid ──► Apply patch to settings-store
        │                  │
        │                  ▼
        │             Compute new hash
        │                  │
        │                  ▼
        │         matches expectedHash?
        │                  │
        │         ┌────────┴────────┐
        │         │                 │
        │        Yes               No
        │         │                 │
        │         ▼                 ▼
        │   Send SETTINGS_APPLIED  Send SETTINGS_REJECTED
        │         │                 │
        │         ▼                 ▼
        │    Flush to disk     Log error
        │    Apply to modules
        └── Invalid ──► Send SETTINGS_REJECTED
                           (validation errors)
```

### 3.4 Inter-Agent Messaging Flow

```
Agent A wants to DM Agent B
        │
        ▼
Send INTER_AGENT_MESSAGE (to: "agent-B-id")
        │
        ▼
Host receives, validates B is online
        │
        ├── B online ──► Deliver as INTER_AGENT_DELIVERY to B
        │                    │
        │                    ▼
        │              Agent B receives
        │              onInterAgentMessage?.(msg)
        │                    │
        └── B offline ──► Drop (log warning)
```

### 3.5 State Streaming Flow

```
Every 30 seconds (or on significant change)
        │
        ▼
Collect current state from other modules:
  - planning: current phase, task
  - sub-agent: active sub-agents
  - metrics: tokens, toolCalls, errors
        │
        ▼
Call updateState(state, metrics)
        │
        ▼
Send AGENT_STATE to host
        │
        ▼
Host forwards to renderer
        │
        ▼
User sees agent status in UI
```

---

## 4. Reconnection Behavior

### 4.1 When Reconnection Happens

Agent reconnects when:
- Initial connect fails
- Connection is closed unexpectedly (not `1000` or `4403`)
- Heartbeat timeout (missed 2 consecutive heartbeats)
- Host sends `KICK` (agent does NOT reconnect automatically)

### 4.2 Reconnection Strategy

```
attempt = 0
delay = 500ms

loop:
  if intentionalClose:
    break
  if maxAttempts > 0 and attempt >= maxAttempts:
    emit 'reconnect_failed'
    break

  connect()
  on failure:
    wait(delay)
    delay = min(delay * 2, 30000)
    attempt++
```

### 4.3 State During Reconnection

During reconnection:
- `connected = false`
- All pending permission requests timeout (resolve to `deny`)
- `updateState()` and `updatePresence()` are no-ops
- Agent continues working locally (does NOT pause)

This is **intentional** — the agent is resilient to SuperHive being down.

### 4.4 Re-registration

On reconnect, the agent:
1. Opens a new WebSocket
2. Sends a new `AGENT_HELLO` (same manifest)
3. May receive a **new `agentId`** if the host doesn't support session continuity
4. Resumes normal operation

There is **no session continuity** in v1 — the host does not remember the agent's previous session.

---

## 5. Security Model

### 5.1 v1 (Current) — Local Trust

- SuperHive binds to `127.0.0.1:7711` (loopback only)
- Any local process can connect
- No API key required
- No TLS (not needed on loopback)
- No message authentication

**Trust boundary**: The local OS user account.

### 5.2 Why This Is Safe for v1

- Both agent and SuperHive run on the same machine
- No network exposure
- User controls both sides
- No remote attack surface

### 5.3 v2 Requirements (Out of Scope)

For remote deployment:
- TLS required on WebSocket server
- API key authentication
- Per-agent keys (not shared)
- HMAC message signing
- Nonce-based replay protection

---

## 6. Directory Structure (Agent Side)

```
~/.general-v1/communication/
├── config.json          # Connection settings
│                        # - host.url
│                        # - host.apiKey
│                        # - reconnect.maxAttempts
│                        # - reconnect.backoffMs
│                        # - heartbeatIntervalMs
│
└── settings.json        # Persisted module settings
                         # (keyed by module name)
```

The module also reads `schema.json` from its own directory for the manifest sent on connect.

---

## 7. Performance Characteristics

| Metric | Value |
|--------|-------|
| Max message size | 1 MB (enforced by host) |
| Heartbeat interval | 15000 ms |
| Heartbeat timeout | 30000 ms (2 missed = close) |
| State stream interval | 30000 ms |
| Max reconnect delay | 30000 ms |
| Default reconnect delays | [500, 1000, 5000, 30000] ms |
| Settings store flush | On SETTINGS_APPLIED, debounced |
| Permission default timeout | 60000 ms (medium severity) |

---

## 8. Observability

### 8.1 Logging

The module logs to stdout with `[communication]` prefix:

```
[communication] connected to ws://127.0.0.1:7711
[communication] registered as agent-xyz
[communication] permission requested { requestId: "req-abc", tool: "file_delete" }
[communication] permission decision: allow
[communication] disconnected: 1000 normal closure
[communication] reconnecting in 500ms (attempt 1)
```

### 8.2 What Is Observable

From SuperHive UI, the user can see:
- Which agents are connected (online/away/busy)
- Current task and phase
- Active sub-agents
- Pending permission requests (with approve/deny)
- Inter-agent message history
- Authority grants
- Token/tool usage metrics

---

## 9. Failure Modes

| Failure | Detection | Handling |
|---------|-----------|----------|
| Host down | Connect fails / WS close | Reconnect with backoff |
| Heartbeat timeout | Missed 2 acks | Close, reconnect |
| Permission timeout | Timer fires | Resolve deny, continue |
| Settings rejected | SETTINGS_REJECTED received | Log error, keep old settings |
| Message dropped | Agent offline | Log warning, no retry |
| Invalid frame from host | v !== 1 or parse error | Close connection |
| Internal error | Exception in handler | Close with 4500 |
