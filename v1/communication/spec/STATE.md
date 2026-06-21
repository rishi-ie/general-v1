# Communication Module — State Machines

**Version**: 1.0.0
**Purpose**: Complete state machine definitions for all stateful components in the agent-side communication module.

---

## 1. Connection State Machine

### 1.1 States

| State | Meaning |
|-------|---------|
| `DISCONNECTED` | Initial state. No WebSocket connection. |
| `CONNECTING` | TCP connection in progress. |
| `AUTHENTICATING` | TCP connected, waiting to send AGENT_HELLO. |
| `REGISTERED` | AGENT_HELLO sent, waiting for HOST_WELCOME. |
| `CONNECTED` | HOST_WELCOME received. Normal operation. |
| `RECONNECTING` | Connection lost, attempting to reconnect. |
| `FAILED` | Max reconnect attempts exceeded. |

### 1.2 State Diagram

```
                    start
                       │
                       ▼
              ┌─────────────────┐
              │   DISCONNECTED   │
              └────────┬────────┘
                       │
              ws.connect()
                       │
                       ▼
              ┌─────────────────┐
              │   CONNECTING     │◄──────────────┐
              └────────┬────────┘               │
                       │                         │
              onopen   │   onerror/close         │
               event   │                         │
                       ▼                         │
              ┌─────────────────┐               │
              │ AUTHENTICATING  │               │
              └────────┬────────┘               │
                       │                         │
              send(AGENT_HELLO)                 │
                       │                         │
                       ▼                         │
              ┌─────────────────┐               │
         ┌────│   REGISTERED   │────┐        │
         │    └─────────────────┘    │        │
         │         │                 │        │
    HOST_WELCOME   │            timeout
         │         │                 │        │
         │         ▼                 │        │
         │    ┌────────┐             │        │
         │    │CONNECTION FAILED     │        │
         │    └────────┘             │        │
         │         │                 │        │
         │         └───────┬─────────┘        │
         │                 │                  │
         ▼                 │                  │
  ┌────────────┐          │                  │
  │ CONNECTED  │  close   │                  │
  │            │──────────►│                  │
  └──────┬─────┘          │                  │
         │                 │                  │
         │    close event  │                  │
         │    (not 1000,   │                  │
         │     not 4403)   │                  │
         │                 │                  │
         ▼                 ▼                  │
  ┌────────────┐   ┌────────────┐            │
  │RECONNECTING│   │RECONNECTING│────────────┘
  └──────┬─────┘   └────────────┘   (loop)
         │
         │ ws.connect()
         │
         │    ┌────────────────┐
         └───►│   CONNECTING   │
              └────────────────┘
```

### 1.3 Transitions

| From | Event | To | Action |
|------|-------|----|--------|
| `DISCONNECTED` | `connect()` called | `CONNECTING` | Open WebSocket |
| `CONNECTING` | `onopen` | `AUTHENTICATING` | Send AGENT_HELLO |
| `AUTHENTICATING` | AGENT_HELLO sent | `REGISTERED` | Start welcome timeout |
| `REGISTERED` | `HOST_WELCOME` received | `CONNECTED` | Clear welcome timeout, set agentId, start heartbeat |
| `REGISTERED` | welcome timeout | `DISCONNECTED` | Close WS, emit error |
| `CONNECTED` | `close` (code 1000) | `DISCONNECTED` | Emit disconnected, stop heartbeat |
| `CONNECTED` | `close` (code 4403) | `DISCONNECTED` | Emit kicked, do not reconnect |
| `CONNECTED` | `close` (any other) | `RECONNECTING` | Emit disconnected, start reconnect |
| `RECONNECTING` | `connect()` called | `CONNECTING` | — |
| `RECONNECTING` | reconnect attempt fails | `RECONNECTING` | Schedule next attempt |
| `RECONNECTING` | max attempts reached | `FAILED` | Emit reconnect_failed |
| `RECONNECTING` | intentional close | `DISCONNECTED` | Cancel timers |
| `FAILED` | `connect()` called | `CONNECTING` | Reset state, reconnect |

### 1.4 Timeout Values

| Timeout | Value | Trigger |
|---------|-------|---------|
| Welcome timeout | 10000 ms | Waiting for HOST_WELCOME after AGENT_HELLO |
| Heartbeat interval | 15000 ms (configurable) | Periodic ping |
| Heartbeat ack timeout | 2 × interval | Missed ack |
| Reconnect delays | [500, 1000, 5000, 30000] ms | Exponential backoff |

---

## 2. Permission Request State Machine

### 2.1 Per-Request States

| State | Meaning |
|-------|---------|
| `PENDING` | Request sent, waiting for decision |
| `GRANTED` | User approved — agent may proceed |
| `DENIED` | User denied or timeout |
| `RESOLVED` | Terminal — result delivered to caller |

### 2.2 State Diagram

```
                   start
                      │
                      ▼
              ┌──────────────┐
              │   PENDING    │
              └──────┬───────┘
                     │
         PERMISSION_DECISION received
                     │
          ┌───────────┴───────────┐
          │                       │
    decision='allow'         decision='deny'
          │                       │
          ▼                       ▼
   ┌─────────────┐       ┌─────────────┐
   │   GRANTED   │       │   DENIED    │
   └──────┬──────┘       └──────┬──────┘
          │                      │
          │    call resolve()    │
          │    (with decision)   │
          │                      │
          ▼                      ▼
   ┌─────────────────────────────────┐
   │           RESOLVED              │
   └─────────────────────────────────┘
```

### 2.3 Transitions

| From | Event | To | Action |
|------|-------|----|--------|
| `PENDING` | `PERMISSION_DECISION` (allow) | `GRANTED` | Clear timer, call `resolve({allow, reason})` |
| `PENDING` | `PERMISSION_DECISION` (deny) | `DENIED` | Clear timer, call `resolve({deny, reason})` |
| `PENDING` | timeout | `DENIED` | Call `resolve({deny, reason: "timeout"})` |
| `GRANTED` | resolve called | `RESOLVED` | — |
| `DENIED` | resolve called | `RESOLVED` | — |

### 2.4 Timeout by Severity

| Severity | Timeout |
|----------|---------|
| `low` | 60,000 ms |
| `medium` | 120,000 ms |
| `high` | 300,000 ms |
| `critical` | 600,000 ms |

---

## 3. Settings Sync State Machine

### 3.1 Per-Agent Settings States

| State | Meaning |
|-------|---------|
| `SYNCED` | Settings match the hash last reported to host |
| `PATCHING` | SETTINGS_UPDATE received, applying patch |
| `VALIDATING` | Checking patch against schema |
| `REJECTED` | Patch invalid — not applied |
| `PERSISTING` | Writing to disk |
| `STABLE` | Terminal — patch applied successfully |

### 3.2 State Diagram

```
SETTINGS_UPDATE received
         │
         ▼
  ┌──────────────┐
  │ VALIDATING   │──── invalid ───► ┌────────────┐
  └──────┬───────┘                   │  REJECTED  │
         │                           └─────┬──────┘
         │ valid                          │ send SETTINGS_REJECTED
         ▼                                ▼
  ┌──────────────┐                  ┌──────────────┐
  │  PATCHING    │─── error ──────►│  REJECTED    │
  └──────┬───────┘                  └──────────────┘
         │ success
         ▼
  ┌──────────────┐
  │ PERSISTING   │
  └──────┬───────┘
         │ flushed
         ▼
  ┌──────────────┐
  │    STABLE    │──── hash matches ───► SYNCED
  └──────────────┘
```

### 3.3 Transitions

| From | Event | To | Action |
|------|-------|----|--------|
| `SYNCED` | `SETTINGS_UPDATE` received | `VALIDATING` | Validate patch |
| `VALIDATING` | patch valid | `PATCHING` | Apply JSON Patch |
| `VALIDATING` | patch invalid | `REJECTED` | Send SETTINGS_REJECTED |
| `PATCHING` | patch applied, new hash matches expected | `PERSISTING` | Write to disk |
| `PATCHING` | patch applied, hash mismatch | `REJECTED` | Send SETTINGS_REJECTED |
| `PATCHING` | exception | `REJECTED` | Send SETTINGS_REJECTED |
| `PERSISTING` | write success | `STABLE` | Send SETTINGS_APPLIED |
| `STABLE` | hash matches | `SYNCED` | — |
| `REJECTED` | SETTINGS_REJECTED sent | `SYNCED` | Keep old settings |

---

## 4. Presence State Machine

### 4.1 States

| State | Meaning |
|-------|---------|
| `ONLINE` | Available for work (default) |
| `AWAY` | Temporarily unavailable |
| `BUSY` | Working, prefer not to be interrupted |
| `OFFLINE` | Disconnecting |

### 4.2 Transitions

| From | To | Event |
|------|----|-------|
| *(start)* | `ONLINE` | AGENT_HELLO sent on connect |
| `ONLINE` | `AWAY` | `updatePresence('away', ...)` |
| `ONLINE` | `BUSY` | `updatePresence('busy', ...)` |
| `AWAY` | `ONLINE` | `updatePresence('online', ...)` |
| `AWAY` | `BUSY` | `updatePresence('busy', ...)` |
| `BUSY` | `ONLINE` | `updatePresence('online', ...)` |
| `BUSY` | `AWAY` | `updatePresence('away', ...)` |
| `ONLINE/AWAY/BUSY` | `OFFLINE` | DISCONNECT sent |

---

## 5. Reconnection State Machine

### 5.1 States

| State | Meaning |
|-------|---------|
| `IDLE` | Not reconnecting |
| `WAITING` | Waiting for backoff delay |
| `RETRYING` | Attempting TCP connection |

### 5.2 State Diagram

```
                      start
                         │
                         ▼
                    ┌─────────┐
                    │  IDLE  │
                    └────┬────┘
                         │
              disconnect (not intentional)
                         │
                         ▼
  ┌───────────────────────────────────┐
  │                                   │
  │  attempt = 0                     │
  │  delay = backoffMs[0]            │
  │                                   │
  └──────────────┬───────────────────┘
                 │
                 ▼
            ┌──────────┐
            │ WAITING  │
            └────┬─────┘
                 │ timer fires
                 ▼
            ┌──────────┐
            │ RETRYING │
            └────┬─────┘
                 │
         ┌───────┴───────┐
         │               │
    connect success  connect fail
         │               │
         ▼               │
    ┌─────────┐          │
    │   IDLE  │          │
    └─────────┘          │
                         ▼
              ┌──────────────────┐
              │ attempt >= max?  │──yes──► (stop, emit FAILED)
              └────────┬─────────┘
                       │ no
                       ▼
              ┌──────────────────┐
              │ delay = min(     │
              │   delay * 2,    │
              │   30000)         │
              └────────┬─────────┘
                       │
                       ▼
                  ┌──────────┐
                  │ WAITING  │
                  └──────────┘
```

---

## 6. Heartbeat State Machine

### 6.1 States

| State | Meaning |
|-------|---------|
| `IDLE` | Not in a heartbeat cycle |
| `PINGING` | Ping sent, waiting for ack |
| `TIMED_OUT` | Terminal — missed ack |

### 6.2 Transitions

| From | Event | To |
|------|-------|----|
| `IDLE` | Interval timer fires | `PINGING` |
| `PINGING` | `HEARTBEAT_ACK` received | `IDLE` |
| `PINGING` | Ack timeout (2 × interval) | `TIMED_OUT` → close connection |

### 6.3 Acknowledged vs. Timed Out

```
t=0        t=15s       t=30s       t=45s
 │           │           │           │
 │  send     │  send     │  send     │
 │  HEARTBEAT│  HEARTBEAT│  HEARTBEAT│
 │           │           │           │
 │◄──────────│◄──────────│◄── ack    │  (missed)
 │  ack      │  ack      │  timeout  │
 │           │           │           │
 │ OK        │ OK        │ TIMED_OUT │
                        │  → close
```

---

## 7. Message Handler State

### 7.1 Handler States

Incoming messages are processed in an implicit state machine based on `type`:

```
receive message
      │
      ▼
 switch(type):
   AGENT_HELLO       → not applicable (agent sends this)
   HOST_WELCOME      → registered state
   AGENT_STATE       → connected state
   PERMISSION_REQUEST→ connected state
   PERMISSION_DECISION→ pending request
   INTER_AGENT_DELIVERY→ connected state
   SETTINGS_UPDATE   → synced or patching state
   SETTINGS_APPLIED  → stable state
   SETTINGS_REJECTED → synced state
   AUTHORITY_GRANT   → connected state
   AUTHORITY_REVOKED  → connected state
   PRESENCE_SNAPSHOT → connected state
   COMMAND           → connected state
   HEARTBEAT_ACK     → pinging state
   KICK              → any state → close
   DISCONNECT        → connected → close
```

### 7.2 Invalid State Handling

| State | Message | Action |
|-------|---------|--------|
| not CONNECTED | any (except HOST_WELCOME) | Log warning, ignore |
| CONNECTED | HOST_WELCOME | Error — already registered |
| not CONNECTED | KICK | Log, close |

---

## 8. Settings Store State

### 8.1 Internal State

The settings store maintains:

```
settings: Map<moduleName, moduleSettings>
hash: string
dirty: boolean
```

### 8.2 Operations

```
load():
  read ~/.general-v1/communication/settings.json
  parse into settings Map
  compute hash
  dirty = false

set(module, value):
  settings.set(module, value)
  dirty = true

flush():
  if not dirty: return
  write settings to disk
  recompute hash
  dirty = false

applyPatch(patch):
  apply to settings Map
  dirty = true
  return new settings object

hash():
  return SHA-256(JSON.stringify(settings, sortedKeys))
```

---

## 9. Authority Grant Lifecycle

### 9.1 Grant States

| State | Meaning |
|-------|---------|
| `ACTIVE` | Grant is valid and in effect |
| `EXPIRED` | TTL reached, no longer valid |
| `REVOKED` | Explicitly revoked by grantor or host |

### 9.2 Transitions

```
grantAuthority():
  create grant record
  grantId = generateId()
  createdAt = now()
  expiresAt = (optional)
  state = ACTIVE

              │
              │ either:
              │ - expiresAt reached
              │ - revokeAuthority(grantId)
              │ - host sends AUTHORITY_REVOKED
              │
              ▼
         ┌──────────┐
         │ ACTIVE   │
         └────┬─────┘
              │
    expiresAt reached    revokeAuthority / host revoke
              │                      │
              ▼                      ▼
        ┌───────────┐         ┌──────────┐
        │  EXPIRED  │         │ REVOKED  │
        └───────────┘         └──────────┘
```

### 9.3 Scope Satisfaction Check

When checking if agent A has authority to perform an action on agent B:

```
hasActiveScope(from, to, requiredScope):
  for each grant in grants:
    if grant.fromAgentId == from
       and grant.toAgentId == to
       and grant.state == ACTIVE
       and (no expiresAt or expiresAt > now)
       and scopeSatisfies(grant.scope, requiredScope):
         return true
  return false

scopeSatisfies(granted, required):
  if required.tools exists:
    if not required.tools ⊆ granted.tools: return false
  if required.paths exists:
    if not required.paths ⊆ granted.paths: return false
  if required.actions exists:
    if not required.actions ⊆ granted.actions: return false
  return true
```
