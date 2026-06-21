# SuperHive Protocol Reference

Complete message reference for the SuperHive WebSocket protocol.

## Envelope

Every message on both the public and internal WebSocket uses this envelope:

```typescript
interface Envelope<T = unknown> {
  v: 1;            // protocol version — must be 1
  type: string;    // message type (see tables below)
  id: string;      // unique message ID (ULID-style)
  ts: number;      // unix timestamp ms
  corr?: string;   // correlation ID (for request/response pairing)
  from?: string;   // sender: agentId or "host"
  to?: string;     // recipient: agentId, groupId, or "*"
  payload: T;      // message body
}
```

---

## Public WebSocket (Agent ↔ Host)

**Port**: 7711 (localhost) or 7711 (remote with TLS)
**Auth**: none (localhost), API key (remote, deferred)

### Agent → Host

#### AGENT_HELLO
First message after WebSocket upgrade. Required before any other messages.

```json
{
  "type": "AGENT_HELLO",
  "from": "agent-xyz",
  "payload": {
    "manifest": {
      "name": "general-v1",
      "version": "1.0.0",
      "description": "General purpose digital employee",
      "capabilities": ["planning", "browser", "memory"],
      "settingsSchema": {
        "type": "object",
        "properties": {
          "maxConcurrent": { "type": "number", "default": 4 }
        }
      },
      "modules": {
        "memory": {
          "version": "1.0.0",
          "settingsSchema": { "type": "object", "properties": {} }
        }
      },
      "interAgent": {
        "acceptsDMs": true,
        "acceptsBroadcasts": true,
        "groups": ["software", "research"]
      }
    },
    "version": "1.0.0",
    "capabilities": ["planning", "browser", "memory"]
  }
}
```

**Response**: `HOST_WELCOME` on success, or connection closed with code:
- `4400` — invalid manifest
- `4401` — unauthorized

---

#### AGENT_STATE
Periodic state push from agent to host.

```json
{
  "type": "AGENT_STATE",
  "from": "agent-xyz",
  "payload": {
    "state": {
      "currentTask": "Building user authentication",
      "phase": "implementation"
    },
    "metrics": {
      "tokensUsed": 45000,
      "toolCalls": 23,
      "turns": 12,
      "errors": 0
    }
  }
}
```

---

#### PERMISSION_REQUEST
Agent requests approval for a sensitive action. Blocks agent until `PERMISSION_DECISION`.

```json
{
  "type": "PERMISSION_REQUEST",
  "from": "agent-xyz",
  "payload": {
    "requestId": "req-abc123",
    "tool": "file_delete",
    "args": { "path": "/tmp/cache.json" },
    "reason": "Deleting stale cache file to free disk space",
    "severity": "medium"
  }
}
```

**Severity levels**: `low`, `medium`, `high`, `critical`

**Response**: `PERMISSION_DECISION`

---

#### INTER_AGENT_MESSAGE
Agent sends a message to another agent, a group, or broadcasts.

```json
{
  "type": "INTER_AGENT_MESSAGE",
  "from": "agent-xyz",
  "payload": {
    "messageId": "msg-def456",
    "to": "agent-abc",
    "broadcast": false,
    "kind": "text",
    "payload": "Here's the auth module you requested"
  }
}
```

**Variants**:
- **DM**: `{ to: "agent-id", broadcast: false }`
- **Broadcast**: `{ broadcast: true }` (no `to` field)
- **Group**: `{ group: "software", broadcast: false }`

**Response**: Delivered as `INTER_AGENT_DELIVERY` to target(s)

---

#### AUTHORITY_GRANT
Agent grants authority to another agent.

```json
{
  "type": "AUTHORITY_GRANT",
  "from": "agent-xyz",
  "payload": {
    "grantId": "grant-ghi789",
    "toAgentId": "agent-abc",
    "scope": {
      "tools": ["read", "bash"],
      "paths": ["/tmp/shared"],
      "actions": ["file_write"]
    },
    "expiresAt": 1735689600000
  }
}
```

---

#### AUTHORITY_REVOKE
Agent revokes a previously granted authority.

```json
{
  "type": "AUTHORITY_REVOKE",
  "from": "agent-xyz",
  "payload": {
    "grantId": "grant-ghi789"
  }
}
```

---

#### PRESENCE_UPDATE
Agent voluntarily updates its presence status.

```json
{
  "type": "PRESENCE_UPDATE",
  "from": "agent-xyz",
  "payload": {
    "status": "busy",
    "activity": "Implementing authentication"
  }
}
```

**Status values**: `online`, `away`, `busy`, `offline`

---

#### SETTINGS_APPLIED
Agent acknowledges a settings push.

```json
{
  "type": "SETTINGS_APPLIED",
  "from": "agent-xyz",
  "payload": {
    "settingsHash": "a1b2c3d4e5f6"
  }
}
```

---

#### SETTINGS_REJECTED
Agent rejects a settings push due to validation failure.

```json
{
  "type": "SETTINGS_REJECTED",
  "from": "agent-xyz",
  "payload": {
    "settingsHash": "a1b2c3d4e5f6",
    "reason": "validation_failed",
    "errors": [
      { "path": "/maxConcurrent", "message": "must be >= 1" }
    ]
  }
}
```

---

#### HEARTBEAT
Keepalive. Agent sends every `heartbeatIntervalMs` (default 15000).

```json
{
  "type": "HEARTBEAT",
  "from": "agent-xyz",
  "payload": {
    "agentId": "agent-xyz",
    "ts": 1735689600000,
    "pingToken": "tok-abc"
  }
}
```

**Response**: `HEARTBEAT_ACK`

---

#### DISCONNECT
Graceful agent disconnect notice.

```json
{
  "type": "DISCONNECT",
  "from": "agent-xyz",
  "payload": {
    "reason": "session ended by user"
  }
}
```

---

### Host → Agent

#### HOST_WELCOME
Sent after successful `AGENT_HELLO`.

```json
{
  "type": "HOST_WELCOME",
  "to": "agent-xyz",
  "payload": {
    "agentId": "agent-xyz",
    "sessionId": "sess-abc",
    "serverVersion": "0.1.0",
    "heartbeatIntervalMs": 15000,
    "assignedGroup": "software"
  }
}
```

---

#### SETTINGS_UPDATE
Host pushes settings to agent as JSON Patch.

```json
{
  "type": "SETTINGS_UPDATE",
  "to": "agent-xyz",
  "payload": {
    "patch": [
      { "op": "replace", "path": "/maxConcurrent", "value": 2 }
    ],
    "expectedHash": "a1b2c3d4e5f6",
    "schema": { "type": "object", "properties": { "maxConcurrent": { "type": "number" } } },
    "urgent": false
  }
}
```

**Agent response**: `SETTINGS_APPLIED` or `SETTINGS_REJECTED`

---

#### PERMISSION_DECISION
Host responds to a `PERMISSION_REQUEST`.

```json
{
  "type": "PERMISSION_DECISION",
  "to": "agent-xyz",
  "payload": {
    "requestId": "req-abc123",
    "decision": "allow",
    "reason": "approved by user",
    "remember": true
  }
}
```

**Decision values**: `allow`, `deny`

---

#### INTER_AGENT_DELIVERY
Host delivers a message from another agent.

```json
{
  "type": "INTER_AGENT_DELIVERY",
  "to": "agent-xyz",
  "payload": {
    "from": "agent-abc",
    "messageId": "msg-def456",
    "kind": "text",
    "payload": "Here's the auth module you requested",
    "receivedAt": 1735689600000
  }
}
```

---

#### AUTHORITY_REVOKED
Host notifies that a grant has been revoked.

```json
{
  "type": "AUTHORITY_REVOKED",
  "to": "agent-xyz",
  "payload": {
    "grantId": "grant-ghi789",
    "reason": "granting agent disconnected"
  }
}
```

---

#### PRESENCE_SNAPSHOT
Full presence picture sent on connect and on change.

```json
{
  "type": "PRESENCE_SNAPSHOT",
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
Host sends an operational command to agent.

```json
{
  "type": "COMMAND",
  "to": "agent-xyz",
  "payload": {
    "command": "pause",
    "args": { "reason": "user requested" }
  }
}
```

**Command values**: `reload`, `restart`, `pause`, `resume`

---

#### HEARTBEAT_ACK
Response to `HEARTBEAT`.

```json
{
  "type": "HEARTBEAT_ACK",
  "to": "agent-xyz",
  "payload": {
    "ts": 1735689600000,
    "pongToken": "tok-abc"
  }
}
```

---

#### KICK
Host forcibly disconnects an agent.

```json
{
  "type": "KICK",
  "to": "agent-xyz",
  "payload": {
    "reason": "kicked by host administrator"
  }
}
```

**Close code**: 4403

---

## Internal WebSocket (Host ↔ Renderer)

**Port**: 7712 (always localhost, always loopback)

Messages use the same envelope format but different `type` values.

### Renderer → Host

| Type | Payload |
|------|---------|
| `LIST_AGENTS` | `{}` |
| `APPROVE_PERMISSION` | `{ requestId, remember? }` |
| `DENY_PERMISSION` | `{ requestId, reason? }` |
| `PUSH_SETTINGS` | `{ agentId, patch, expectedHash? }` |
| `SEND_MESSAGE` | `{ from, to?, group?, broadcast?, kind, payload }` |
| `REVOKE_AUTHORITY` | `{ grantId }` |
| `KICK_AGENT` | `{ agentId, reason? }` |
| `SEND_COMMAND` | `{ agentId, command, args? }` |

### Host → Renderer

| Type | Payload |
|------|---------|
| `AGENT_CONNECTED` | `{ agent: AgentRecord }` |
| `AGENT_DISCONNECTED` | `{ agentId, reason }` |
| `AGENT_STATE_CHANGED` | `{ agentId, state, metrics? }` |
| `PERMISSION_REQUESTED` | `{ agentId, request: PendingRequest }` |
| `PERMISSION_RESOLVED` | `{ agentId, requestId, decision }` |
| `INTER_AGENT_DELIVERY` | `{ message: InterAgentMessage }` |
| `AUTHORITY_CHANGED` | `{ change: 'granted' \| 'revoked', grant }` |
| `PRESENCE_CHANGED` | `{ snapshot: PresenceEntry[] }` |
| `SETTINGS_PUSH_RESULT` | `{ agentId, ok, errors? }` |
| `AUDIT_EVENT` | `{ event: AuditEvent }` |
| `LOG` | `{ level, source, message, meta? }` |
| `INITIAL_SNAPSHOT` | `{ agents, permissions, authority, presence }` |

---

## Close Codes

| Code | Meaning |
|------|---------|
| 1000 | Normal closure (goodbye) |
| 1001 | Server going away |
| 4400 | Bad request / invalid frame |
| 4401 | Unauthorized |
| 4403 | Kicked |
| 4408 | Heartbeat timeout |
| 4500 | Internal server error |

---

## Error Handling Rules

1. Unknown `type` → ignored (log and continue)
2. Missing required fields → close with 4400
3. Protocol version mismatch → close with 4400
4. Rate limit exceeded → close with 4400
5. Internal error → close with 4500, log details
