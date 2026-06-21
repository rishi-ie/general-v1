# Communication Protocol Specification

**Version**: 1.0.0
**Protocol Version**: `1`
**Transport**: WebSocket (JSON text frames)
**Scope**: Agent ↔ SuperHive (host) communication

---

## 1. Envelope

Every message on the WebSocket is a JSON object (one frame = one logical message) conforming to this envelope:

```typescript
interface Envelope<T = unknown> {
  v: 1;                      // protocol version — must be 1
  type: string;              // message type (see tables below)
  id: string;                // unique message ID (ULID-style: time-random-random)
  ts: number;                // unix timestamp milliseconds
  corr?: string;             // correlation ID — set when this is a response to a prior message
  from?: string;             // sender identifier
  to?: string;               // intended recipient (agentId, groupId, or "*")
  payload: T;               // message body — type varies by `type`
}
```

**Field rules**:
- `v` is required and must be exactly `1`. Any other value causes connection close with code `4400`.
- `type` is required and must be a known message type.
- `id` is required. Must be unique per sender per session.
- `ts` is required. Must be a positive integer.
- `corr` is optional. When present, indicates this message is a response to the message with that `id`.
- `from` is optional on outbound messages; the host sets `from: "host"` for host-originated messages.
- `to` is optional. Used for directed messages.
- `payload` is always required and must not be `null`. Use `{}` if no data.

### 1.1 ID Generation

Message IDs use a ULID-inspired format for sortability and uniqueness:

```
${timestamp-base36}-${random8chars}-${random4chars}
```

Example: `1k1p3d8c-8m5t2rp1-ab3f`

The timestamp is the lower 48 bits of Unix ms in base-36. This gives IDs that are time-sortable within a session.

### 1.2 Framing

- One JSON object per WebSocket text frame.
- No batching — do not send multiple envelopes in a single frame.
- Binary frames are reserved for future use (v2: file transfer). Agents must reject binary frames in v1.

---

## 2. Connection Lifecycle

### 2.1 Full Lifecycle

```
Agent (client)                              SuperHive (server)
    |                                             |
    |------- WS Upgrade (TCP) ------------------->|
    |<------ 101 Switching Protocols -------------|
    |                                             |
    |------- AGENT_HELLO (manifest) ------------>|
    |              |                              | validate manifest
    |              | check API key (if req'd)    |
    |<------ HOST_WELCOME (agentId) -------------|
    |                                             |
    |======= SESSION ACTIVE =====================|
    |                                             |
    |------- HEARTBEAT (every 15s) ------------->|
    |<------ HEARTBEAT_ACK -----------------------|
    |                                             |
    |------- AGENT_STATE (every 30s) ----------->|
    |                                             |
    |<------ SETTINGS_UPDATE --------------------|
    |------- SETTINGS_APPLIED ------------------>|
    |                                             |
    |------- PERMISSION_REQUEST ---------------->|
    |<------ PERMISSION_DECISION ----------------|
    |                                             |
    |------- INTER_AGENT_MESSAGE --------------->
    |<------ INTER_AGENT_DELIVERY ---------------
    |                                             |
    |<------ COMMAND (reload/pause/resume) -------|
    |                                             |
    |------- DISCONNECT ------------------------>|
    |<------ (close) ----------------------------|
```

### 2.2 Connection Establishment

1. Agent opens WebSocket to `ws://host:7711` (or configured URL)
2. If `apiKey` is configured, agent includes `Authorization: Bearer <key>` header
3. Agent immediately sends `AGENT_HELLO` with its manifest
4. Host validates manifest against schema
5. If valid, host sends `HOST_WELCOME` with the assigned `agentId` and `sessionId`
6. If invalid, host closes with code `4400` and reason
7. If unauthorized (bad API key), host closes with code `4401`
8. Agent is now in **SESSION ACTIVE** state

### 2.3 Heartbeat

- Agent sends `HEARTBEAT` every `heartbeatIntervalMs` (default 15000ms, announced in `HOST_WELCOME`)
- Host responds with `HEARTBEAT_ACK`
- If two consecutive heartbeats go unanswered, host closes with code `4408` (heartbeat timeout)
- Host pings TCP-level ping (WebSocket `pong`) every 15s as well
- If agent misses two `HEARTBEAT_ACK`, agent reconnects

### 2.4 Disconnection

**Graceful** (agent-initiated):
```
Agent ------- DISCONNECT ----------------> Host
Agent ------- (TCP close) --------------->
Host ------- (TCP close) --------------->
```

**Forced** (host-initiated):
```
Host -------- KICK (reason) -------------> Agent
Host -------- (TCP close) --------------->
```

**Accidental** (network failure):
- Host detects via heartbeat timeout (4408)
- Agent detects via `HEARTBEAT_ACK` timeout
- Both attempt reconnect with backoff

### 2.5 Reconnection

Agent reconnects automatically with exponential backoff:

```
attempt 0: 500ms
attempt 1: 1000ms
attempt 2: 5000ms
attempt 3+: 30000ms (capped)
```

On reconnect, agent:
1. Opens new WebSocket
2. Sends `AGENT_HELLO` (same manifest)
3. Receives new `HOST_WELCOME` (may have same or new `agentId`)
4. Resumes normal operation

If `maxAttempts` is set (not `-1`) and exceeded, agent stops trying and emits `reconnect_failed`.

---

## 3. Message Reference

### 3.1 Agent → Host Messages

#### AGENT_HELLO

**Direction**: Agent → Host
**When**: First message after WebSocket connect. Required before any other messages.
**Expects response**: `HOST_WELCOME`

```json
{
  "v": 1,
  "type": "AGENT_HELLO",
  "id": "1k1p3d8c-8m5t2rp1-ab3f",
  "ts": 1735689600000,
  "payload": {
    "manifest": {
      "name": "general-v1",
      "version": "1.0.0",
      "description": "General purpose digital employee",
      "capabilities": ["planning", "browser", "memory", "sub-agents"],
      "settingsSchema": {
        "type": "object",
        "properties": {
          "maxConcurrent": {
            "type": "number",
            "default": 4,
            "minimum": 1,
            "maximum": 8
          },
          "autoRecall": {
            "type": "boolean",
            "default": true
          }
        }
      },
      "interAgent": {
        "acceptsDMs": true,
        "acceptsBroadcasts": true,
        "groups": ["general", "software", "research"]
      },
      "modules": {
        "memory": {
          "version": "1.0.0",
          "settingsSchema": {
            "type": "object",
            "properties": {
              "autoRecall": { "type": "boolean" }
            }
          }
        },
        "sub-agent": {
          "version": "1.0.0",
          "settingsSchema": {
            "type": "object",
            "properties": {
              "maxConcurrent": { "type": "number" }
            }
          }
        }
      }
    },
    "version": "1.0.0",
    "capabilities": ["planning", "browser", "memory", "sub-agents"]
  }
}
```

**Validation rules**:
- `manifest.name` — required, 1–64 chars
- `manifest.version` — required, semver format `X.Y.Z`
- `manifest.capabilities` — required, array of 0–100 strings, each 1–64 chars
- `manifest.settingsSchema` — required, valid JSON Schema (object)
- `manifest.interAgent` — optional; if absent, defaults to no DMs/broadcasts/groups
- `manifest.modules` — optional; keys are module names, values have `version` + `settingsSchema`

**Error responses**:
- `4400` — invalid manifest (validation errors)
- `4401` — unauthorized (bad API key)

---

#### AGENT_STATE

**Direction**: Agent → Host
**When**: Periodic (every 30s by default) or on significant state change
**Expects response**: None

```json
{
  "v": 1,
  "type": "AGENT_STATE",
  "id": "1k1p3d8c-8m5t2rp2-cd4e",
  "ts": 1735689600000,
  "from": "agent-xyz",
  "payload": {
    "state": {
      "currentTask": "Building user authentication",
      "phase": "implementation",
      "subAgents": [
        { "id": "sub-1", "type": "debugger", "status": "running" },
        { "id": "sub-2", "type": "writer", "status": "paused" }
      ]
    },
    "metrics": {
      "tokensUsed": 45230,
      "toolCalls": 47,
      "turns": 23,
      "errors": 1
    }
  }
}
```

**All fields in `state` are optional** — send only what is currently relevant.
**`metrics` is optional** — omit if metrics are not available.

---

#### PERMISSION_REQUEST

**Direction**: Agent → Host
**When**: Agent wants to perform a sensitive action requiring SuperHive approval
**Expects response**: `PERMISSION_DECISION`
**Blocking**: Agent MUST wait for decision before proceeding with the action

```json
{
  "v": 1,
  "type": "PERMISSION_REQUEST",
  "id": "1k1p3d8c-8m5t2rp3-ef5g",
  "ts": 1735689600000,
  "from": "agent-xyz",
  "payload": {
    "requestId": "req-hj7k9m",
    "tool": "file_delete",
    "args": {
      "path": "/tmp/cache.json",
      "recursive": false
    },
    "reason": "Deleting stale cache file (unchanged for 7 days) to free disk space",
    "severity": "medium"
  }
}
```

**Severity levels**:
| Level | Description | Default timeout |
|-------|-------------|-----------------|
| `low` | Minor side effects, easily reversible | 60s |
| `medium` | Moderate impact, partially reversible | 120s |
| `high` | Significant impact, hard to reverse | 300s |
| `critical` | Major impact, irreversible consequences | 600s |

**`requestId`** must be unique per request per agent session.

**`tool`** is a string identifying the action type. Common values:
- `file_delete` — delete files
- `file_write` — write/modify files
- `command_execute` — run shell commands
- `sub_agent_spawn` — spawn a sub-agent
- `network_request` — make HTTP requests
- `memory_delete` — delete memories

**Behavior on timeout**:
- If no `PERMISSION_DECISION` arrives within the timeout, the request resolves to `deny` with reason `"timeout"`.

---

#### INTER_AGENT_MESSAGE

**Direction**: Agent → Host
**When**: Agent wants to send a message to another agent, a group, or all agents
**Expects response**: None (fire-and-forget, delivery is best-effort)

```json
{
  "v": 1,
  "type": "INTER_AGENT_MESSAGE",
  "id": "1k1p3d8c-8m5t2rp4-gh6h",
  "ts": 1735689600000,
  "from": "agent-xyz",
  "payload": {
    "messageId": "msg-pq8r2t",
    "to": "agent-abc",
    "broadcast": false,
    "group": null,
    "kind": "text",
    "payload": "Here's the auth module data you requested"
  }
}
```

**Routing rules** (mutually exclusive fields):
| Field | Value | Meaning |
|-------|-------|---------|
| `to` | agent ID | Direct message to specific agent |
| `broadcast` | `true` | Broadcast to all connected agents (except sender) |
| `group` | group name string | Send to all members of that group |
| `to` + `broadcast` | — | If `broadcast: true`, `to` is ignored |
| none of above | — | Invalid — host rejects |

**`kind`** values:
| Kind | Meaning |
|------|---------|
| `text` | Plain text message |
| `request` | Request expecting a `response` reply |
| `response` | Reply to a `request` |
| `event` | One-way event notification |

**`payload`** is arbitrary — can be a string, object, array, etc.

---

#### AUTHORITY_GRANT

**Direction**: Agent → Host
**When**: Agent wants to grant authority to another agent
**Expects response**: None

```json
{
  "v": 1,
  "type": "AUTHORITY_GRANT",
  "id": "1k1p3d8c-8m5t2rp5-ij7i",
  "ts": 1735689600000,
  "from": "agent-xyz",
  "payload": {
    "grantId": "grant-uv3w5x",
    "toAgentId": "agent-abc",
    "scope": {
      "tools": ["read", "bash"],
      "paths": ["/tmp/shared", "/workspace/common"],
      "actions": ["file_write", "command_execute"]
    },
    "expiresAt": 1735776000000
  }
}
```

**`grantId`** must be unique. Generate with `generateId()`.
**`expiresAt`** is optional. Omit for no expiry.
**All fields in `scope` are optional** — omit a field to grant unrestricted access for that dimension.

---

#### AUTHORITY_REVOKE

**Direction**: Agent → Host
**When**: Agent wants to revoke a previously granted authority
**Expects response**: None

```json
{
  "v": 1,
  "type": "AUTHORITY_REVOKE",
  "id": "1k1p3d8c-8m5t2rp6-jk8j",
  "ts": 1735689600000,
  "from": "agent-xyz",
  "payload": {
    "grantId": "grant-uv3w5x"
  }
}
```

Host removes the grant and sends `AUTHORITY_REVOKED` to the affected agent.

---

#### PRESENCE_UPDATE

**Direction**: Agent → Host
**When**: Agent wants to voluntarily update its presence status
**Expects response**: None

```json
{
  "v": 1,
  "type": "PRESENCE_UPDATE",
  "id": "1k1p3d8c-8m5t2rp7-kl9k",
  "ts": 1735689600000,
  "from": "agent-xyz",
  "payload": {
    "status": "busy",
    "activity": "Implementing authentication module"
  }
}
```

**Status values**:
| Status | Meaning |
|--------|---------|
| `online` | Available for work (default on connect) |
| `away` | Temporarily unavailable |
| `busy` | Working on a task, prefer not to interrupt |
| `offline` | Disconnecting (sent before DISCONNECT) |

**`activity`** is optional free-text description of current work.

---

#### SETTINGS_APPLIED

**Direction**: Agent → Host
**When**: Agent has successfully applied a `SETTINGS_UPDATE`
**Expects response**: None

```json
{
  "v": 1,
  "type": "SETTINGS_APPLIED",
  "id": "1k1p3d8c-8m5t2rp8-lm0l",
  "ts": 1735689600000,
  "from": "agent-xyz",
  "payload": {
    "settingsHash": "a1b2c3d4e5f6"
  }
}
```

**`settingsHash`** — the hash of the agent's settings after the patch was applied. Used by host to confirm the patch took effect.

---

#### SETTINGS_REJECTED

**Direction**: Agent → Host
**When**: Agent could not apply a `SETTINGS_UPDATE` (validation failed or internal error)
**Expects response**: None

```json
{
  "v": 1,
  "type": "SETTINGS_REJECTED",
  "id": "1k1p3d8c-8m5t2rp9-mn1m",
  "ts": 1735689600000,
  "from": "agent-xyz",
  "payload": {
    "settingsHash": "a1b2c3d4e5f6",
    "reason": "validation_failed",
    "errors": [
      { "path": "/maxConcurrent", "message": "must be <= 8" }
    ]
  }
}
```

---

#### HEARTBEAT

**Direction**: Agent → Host
**When**: Every `heartbeatIntervalMs` (default 15000)
**Expects response**: `HEARTBEAT_ACK`

```json
{
  "v": 1,
  "type": "HEARTBEAT",
  "id": "1k1p3d8c-8m5t2rp0-no2n",
  "ts": 1735689600000,
  "from": "agent-xyz",
  "payload": {
    "agentId": "agent-xyz",
    "ts": 1735689600000,
    "pingToken": "tok-abc123"
  }
}
```

**`pingToken`** — opaque string echoed back in `HEARTBEAT_ACK`. Used by agent to match ack to request.

---

#### DISCONNECT

**Direction**: Agent → Host
**When**: Graceful disconnect (session ending)
**Expects response**: None (then TCP close)

```json
{
  "v": 1,
  "type": "DISCONNECT",
  "id": "1k1p3d8c-8m5t2rp1-op3o",
  "ts": 1735689600000,
  "from": "agent-xyz",
  "payload": {
    "reason": "session ended by user"
  }
}
```

---

### 3.2 Host → Agent Messages

#### HOST_WELCOME

**Direction**: Host → Agent
**When**: After successful `AGENT_HELLO` validation

```json
{
  "v": 1,
  "type": "HOST_WELCOME",
  "id": "1k1p3d8c-8m5t2rp2-qp4p",
  "ts": 1735689600000,
  "to": "agent-xyz",
  "payload": {
    "agentId": "agent-xyz",
    "sessionId": "sess-abc123",
    "serverVersion": "0.1.0",
    "heartbeatIntervalMs": 15000,
    "assignedGroup": "software"
  }
}
```

**`agentId`** — the canonical ID for this agent in the SuperHive fleet.
**`sessionId`** — unique per connection session. Changes on reconnect.
**`assignedGroup`** — optional group the agent was assigned to on connect.

---

#### SETTINGS_UPDATE

**Direction**: Host → Agent
**When**: User pushes new settings from SuperHive UI
**Expects response**: `SETTINGS_APPLIED` or `SETTINGS_REJECTED`

```json
{
  "v": 1,
  "type": "SETTINGS_UPDATE",
  "id": "1k1p3d8c-8m5t2rp3-qr5q",
  "ts": 1735689600000,
  "to": "agent-xyz",
  "payload": {
    "patch": [
      { "op": "replace", "path": "/maxConcurrent", "value": 2 }
    ],
    "expectedHash": "a1b2c3d4e5f6",
    "schema": {
      "type": "object",
      "properties": {
        "maxConcurrent": { "type": "number" }
      }
    },
    "urgent": false
  }
}
```

**`patch`** — JSON Patch (RFC 6902) operations to apply. See JSON Patch spec below.
**`expectedHash`** — hash the agent's settings should have BEFORE applying the patch. If the agent's current hash doesn't match, reject with `SETTINGS_REJECTED`.
**`schema`** — the JSON Schema against which the agent should validate the patched settings before applying.
**`urgent`** — if `true`, agent should apply immediately without waiting for a natural pause point.

**JSON Patch operations supported**:
| Op | Description |
|----|-------------|
| `add` | Add or replace a value at path |
| `remove` | Remove a value at path |
| `replace` | Replace an existing value (same as add on existing) |
| `test` | Test that a value matches (error if not) |

Paths use JSON Pointer (RFC 6901) — `/`-separated keys, empty string for root.

---

#### PERMISSION_DECISION

**Direction**: Host → Agent
**When**: User resolves a `PERMISSION_REQUEST` in SuperHive UI

```json
{
  "v": 1,
  "type": "PERMISSION_DECISION",
  "id": "1k1p3d8c-8m5t2rp4-rs6r",
  "ts": 1735689600000,
  "to": "agent-xyz",
  "corr": "req-hj7k9m",
  "payload": {
    "requestId": "req-hj7k9m",
    "decision": "allow",
    "reason": "approved by user",
    "remember": true
  }
}
```

**`decision`** values:
| Value | Meaning |
|-------|---------|
| `allow` | Agent may proceed with the action |
| `deny` | Agent must not proceed with the action |

**`remember`** — if `true`, the host may auto-approve similar requests in the future without asking.

---

#### INTER_AGENT_DELIVERY

**Direction**: Host → Agent
**When**: A message from another agent arrives, addressed to this agent

```json
{
  "v": 1,
  "type": "INTER_AGENT_DELIVERY",
  "id": "1k1p3d8c-8m5t2rp5-st7s",
  "ts": 1735689600000,
  "to": "agent-xyz",
  "payload": {
    "from": "agent-abc",
    "messageId": "msg-pq8r2t",
    "kind": "text",
    "payload": "Here's the auth module data you requested",
    "receivedAt": 1735689600000
  }
}
```

---

#### AUTHORITY_REVOKED

**Direction**: Host → Agent
**When**: A grant involving this agent has been revoked (by the granting agent or by host)

```json
{
  "v": 1,
  "type": "AUTHORITY_REVOKED",
  "id": "1k1p3d8c-8m5t2rp6-tu8t",
  "ts": 1735689600000,
  "to": "agent-xyz",
  "payload": {
    "grantId": "grant-uv3w5x",
    "reason": "granting agent disconnected"
  }
}
```

---

#### PRESENCE_SNAPSHOT

**Direction**: Host → Agent
**When**: On connect (full snapshot) and when presence changes (incremental diffed)

```json
{
  "v": 1,
  "type": "PRESENCE_SNAPSHOT",
  "id": "1k1p3d8c-8m5t2rp7-uv9u",
  "ts": 1735689600000,
  "to": "agent-xyz",
  "payload": {
    "agents": [
      { "agentId": "agent-xyz", "status": "online", "activity": null, "lastSeen": 1735689600000 },
      { "agentId": "agent-abc", "status": "busy", "activity": "researching", "lastSeen": 1735689590000 }
    ]
  }
}
```

---

#### COMMAND

**Direction**: Host → Agent
**When**: User sends an operational command from SuperHive UI

```json
{
  "v": 1,
  "type": "COMMAND",
  "id": "1k1p3d8c-8m5t2rp8-vw0v",
  "ts": 1735689600000,
  "to": "agent-xyz",
  "payload": {
    "command": "pause",
    "args": {
      "reason": "user requested"
    }
  }
}
```

**Command values**:
| Command | Meaning |
|---------|---------|
| `reload` | Reload configuration and restart current task |
| `restart` | Full restart — end session and reconnect |
| `pause` | Pause current task, do not accept new work |
| `resume` | Resume from paused state |

---

#### HEARTBEAT_ACK

**Direction**: Host → Agent
**When**: Reply to `HEARTBEAT`

```json
{
  "v": 1,
  "type": "HEARTBEAT_ACK",
  "id": "1k1p3d8c-8m5t2rp9-wx1w",
  "ts": 1735689600000,
  "to": "agent-xyz",
  "corr": "tok-abc123",
  "payload": {
    "ts": 1735689600000,
    "pongToken": "tok-abc123"
  }
}
```

---

#### KICK

**Direction**: Host → Agent
**When**: User kicks the agent from SuperHive UI

```json
{
  "v": 1,
  "type": "KICK",
  "id": "1k1p3d8c-8m5t2rp0-xy2x",
  "ts": 1735689600000,
  "to": "agent-xyz",
  "payload": {
    "reason": "kicked by host administrator"
  }
}
```

Agent should:
1. Log the reason
2. Send `DISCONNECT`
3. Close WebSocket with code `4403`
4. Do NOT reconnect (unless explicitly told to by user)

---

## 4. Close Codes

| Code | Name | Meaning | Who sends |
|------|------|---------|-----------|
| `1000` | Normal Closure | Graceful disconnect | Both |
| `1001` | Going Away | Server shutting down | Host |
| `4400` | Bad Request | Invalid frame / unsupported protocol version / invalid manifest | Both |
| `4401` | Unauthorized | Bad API key | Host |
| `4403` | Kicked | Agent was kicked by host | Host |
| `4408` | Heartbeat Timeout | No response to heartbeat | Host |
| `4500` | Internal Error | Unexpected server error | Both |

---

## 5. Error Handling Rules

1. **Unknown `type`** — silently ignored (log and continue)
2. **Missing required payload fields** — send `SETTINGS_REJECTED` for settings; for other messages, log and continue
3. **Protocol version mismatch** (`v !== 1`) — close with code `4400`
4. **Rate limiting** — not enforced in v1 (deferred)
5. **Internal error** — close with code `4500`, log details server-side
6. **Permission timeout** — resolve to `deny` with reason `"timeout"`
7. **Settings hash mismatch** — agent rejects with `SETTINGS_REJECTED`, does not apply

---

## 6. Protocol Versioning

The protocol version is `1` and is permanent for v1. When breaking changes are needed:

1. Bump protocol version to `2`
2. Agent and host must both support `2` before using it
3. `HOST_WELCOME` announces the server's supported versions
4. Agent uses the highest mutually supported version

---

## 7. Security Considerations

**v1 has minimal security** (local trust model):
- No encryption (local loopback only)
- No authentication (local trust)
- No message signing
- No replay protection

**For v2** (out of scope):
- TLS required for non-loopback connections
- API key authentication (Bearer token)
- Per-message HMAC signatures
- Nonce-based replay protection
