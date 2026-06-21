# Communication Module — Schema Reference

**Version**: 1.0.0
**Purpose**: Complete TypeScript interface definitions and JSON Schema specifications for all data structures in the communication protocol.

---

## 1. TypeScript Interfaces

### 1.1 Core Envelope

```typescript
interface Envelope<T = unknown> {
  v: 1;                      // protocol version — always 1
  type: string;              // message type
  id: string;                // unique message ID (ULID-style)
  ts: number;                // unix timestamp ms
  corr?: string;             // correlation ID (for responses)
  from?: string;             // sender (agentId or "host")
  to?: string;               // recipient (agentId, groupId, "*")
  payload: T;               // message body
}
```

### 1.2 Agent Manifest

```typescript
interface AgentManifest {
  name: string;                              // 1–64 chars
  version: string;                           // semver "X.Y.Z"
  description?: string;                      // optional, max 500 chars
  capabilities: string[];                   // 0–100 items, each 1–64 chars
  settingsSchema: JsonSchema;               // JSON Schema for settings validation
  permissions?: string[];                    // optional hints for UI
  interAgent?: {
    acceptsDMs: boolean;                     // default false if absent
    acceptsBroadcasts: boolean;              // default false if absent
    groups: string[];                        // groups this agent can join
  };
  modules?: Record<string, ModuleInfo>;     // keyed by module name
}

interface ModuleInfo {
  version: string;                           // semver "X.Y.Z"
  settingsSchema: JsonSchema;               // per-module settings schema
}
```

### 1.3 Agent State

```typescript
interface AgentState {
  currentTask?: string;                      // human-readable current task
  phase?: string;                            // current phase (e.g., "planning", "implementation")
  subAgents?: SubAgentStatus[];              // active sub-agents
}

interface SubAgentStatus {
  id: string;                                // sub-agent's unique ID
  type: string;                              // sub-agent type (e.g., "debugger", "writer")
  status: 'running' | 'paused' | 'done' | 'failed';
}
```

### 1.4 Metrics

```typescript
interface Metrics {
  tokensUsed?: number;                        // total tokens used this session
  toolCalls?: number;                         // total tool invocations
  turns?: number;                            // total conversation turns
  errors?: number;                            // total errors encountered
}
```

### 1.5 Inter-Agent Message

```typescript
interface InterAgentMessage {
  messageId: string;                          // unique per message
  from: string;                               // sender agentId
  to?: string;                                // recipient agentId (if DM)
  group?: string;                             // group name (if group message)
  broadcast?: boolean;                        // if true, broadcast to all
  kind: 'text' | 'request' | 'response' | 'event';
  payload: unknown;                           // arbitrary content
  receivedAt: number;                        // unix timestamp ms (set by host on delivery)
}
```

**Routing**: Exactly one of `to`, `group`, or `broadcast: true` must be set.

### 1.6 Authority

```typescript
interface AuthorityGrant {
  grantId: string;                            // unique grant ID
  fromAgentId: string;                        // granting agent
  toAgentId: string;                          // grantee agent
  scope: AuthorityScope;                      // what is granted
  createdAt: number;                         // unix timestamp ms
  expiresAt?: number;                         // unix timestamp ms (optional)
  revokedAt?: number;                         // unix timestamp ms (set on revocation)
}

interface AuthorityScope {
  tools?: string[];                           // allowed tools (omit = all)
  paths?: string[];                           // allowed paths (omit = all)
  actions?: string[];                         // allowed actions (omit = all)
}
```

### 1.7 Permission

```typescript
interface PendingRequest {
  requestId: string;                          // unique per request
  tool: string;                               // action type (e.g., "file_delete")
  args: unknown;                              // arguments to the action
  reason: string;                             // human-readable justification
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface PermissionDecision {
  decision: 'allow' | 'deny';
  reason?: string;                            // optional explanation
  remember?: boolean;                         // if true, auto-approve similar
}
```

### 1.8 Settings

```typescript
interface SettingsPatch {
  op: 'add' | 'remove' | 'replace' | 'test';
  path: string;                               // JSON Pointer (RFC 6901)
  value?: unknown;                            // required for add/replace/test
}

interface ValidationError {
  path: string;                               // JSON Pointer path
  message: string;                            // human-readable error
}
```

### 1.9 Presence

```typescript
type PresenceStatus = 'online' | 'away' | 'busy' | 'offline';

interface PresenceEntry {
  agentId: string;
  status: PresenceStatus;
  activity?: string;                           // free-text current activity
  lastSeen: number;                            // unix timestamp ms
}
```

### 1.10 Host Command

```typescript
type HostCommand = 'reload' | 'restart' | 'pause' | 'resume';
```

---

## 2. JSON Schema Reference

### 2.1 Agent Manifest Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["name", "version", "settingsSchema", "capabilities"],
  "additionalProperties": true,
  "properties": {
    "name": {
      "type": "string",
      "minLength": 1,
      "maxLength": 64,
      "description": "Unique name for this agent instance"
    },
    "version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$",
      "description": "Semantic version of this agent"
    },
    "description": {
      "type": "string",
      "maxLength": 500,
      "description": "Human-readable description"
    },
    "capabilities": {
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1,
        "maxLength": 64
      },
      "minItems": 0,
      "maxItems": 100,
      "uniqueItems": true,
      "description": "List of capabilities this agent supports"
    },
    "settingsSchema": {
      "type": "object",
      "description": "JSON Schema for this agent's settings (full settings object)"
    },
    "permissions": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Hints for UI — actions this agent may request permission for"
    },
    "interAgent": {
      "type": "object",
      "properties": {
        "acceptsDMs": { "type": "boolean", "default": false },
        "acceptsBroadcasts": { "type": "boolean", "default": false },
        "groups": {
          "type": "array",
          "items": { "type": "string", "minLength": 1, "maxLength": 64 },
          "uniqueItems": true
        }
      },
      "additionalProperties": false
    },
    "modules": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "required": ["version", "settingsSchema"],
        "properties": {
          "version": { "type": "string", "pattern": "^\\d+\\.\\d+\\.\\d+$" },
          "settingsSchema": { "type": "object" }
        },
        "additionalProperties": false
      }
    }
  }
}
```

### 2.2 Settings Schema Example (General V1)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "maxConcurrent": {
      "type": "number",
      "default": 4,
      "minimum": 1,
      "maximum": 8,
      "description": "Maximum concurrent sub-agents"
    },
    "autoRecall": {
      "type": "boolean",
      "default": true,
      "description": "Automatically recall relevant memories"
    },
    "requireSuperhiveApproval": {
      "type": "array",
      "items": { "type": "string" },
      "default": ["file_delete", "command_execute", "sub_agent_spawn"],
      "description": "Actions requiring SuperHive approval"
    },
    "presenceStatus": {
      "type": "string",
      "enum": ["online", "away", "busy"],
      "default": "online",
      "description": "Default presence status"
    }
  },
  "additionalProperties": true
}
```

### 2.3 Module Settings Schema (per module)

```json
{
  "memory": {
    "type": "object",
    "properties": {
      "autoRecall": { "type": "boolean" },
      "retentionDays": { "type": "number", "minimum": 1 },
      "maxMemories": { "type": "number", "minimum": 1 }
    }
  },
  "sub-agent": {
    "type": "object",
    "properties": {
      "maxConcurrent": { "type": "number" },
      "defaultMaxTurns": { "type": "number" },
      "defaultModel": { "type": "string" }
    }
  },
  "permission": {
    "type": "object",
    "properties": {
      "defaultPolicy": { "type": "string", "enum": ["allow", "deny", "ask"] },
      "timeoutMs": { "type": "number" }
    }
  }
}
```

### 2.4 JSON Patch Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "array",
  "items": {
    "type": "object",
    "required": ["op", "path"],
    "properties": {
      "op": {
        "type": "string",
        "enum": ["add", "remove", "replace", "test"]
      },
      "path": {
        "type": "string",
        "pattern": "^/"
      },
      "value": {}
    },
    "additionalProperties": false
  }
}
```

**JSON Pointer (RFC 6901) path examples**:
- `/maxConcurrent` — top-level key
- `/modules/memory/autoRecall` — nested key
- `/` — root (only for replace/add on entire object)

### 2.5 Inter-Agent Message Payload Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["messageId", "kind"],
  "properties": {
    "messageId": { "type": "string", "minLength": 1 },
    "to": { "type": "string" },
    "group": { "type": "string" },
    "broadcast": { "type": "boolean" },
    "kind": {
      "type": "string",
      "enum": ["text", "request", "response", "event"]
    },
    "payload": {}
  },
  "oneOf": [
    { "required": ["to"], "properties": { "to": { "type": "string", "minLength": 1 } } },
    { "required": ["broadcast"], "properties": { "broadcast": { "type": "boolean", "enum": [true] } } },
    { "required": ["group"], "properties": { "group": { "type": "string", "minLength": 1 } } }
  ]
}
```

---

## 3. Configuration Schema

### 3.1 Module Config (`~/.general-v1/communication/config.json`)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["host"],
  "properties": {
    "host": {
      "type": "object",
      "required": ["url"],
      "properties": {
        "url": {
          "type": "string",
          "format": "uri",
          "default": "ws://127.0.0.1:7711",
          "description": "WebSocket URL of SuperHive host"
        },
        "apiKey": {
          "type": "string",
          "default": "",
          "description": "API key for authentication (v2)"
        }
      },
      "additionalProperties": false
    },
    "reconnect": {
      "type": "object",
      "properties": {
        "maxAttempts": {
          "type": "number",
          "default": -1,
          "description": "Max reconnect attempts (-1 = infinite)"
        },
        "backoffMs": {
          "type": "array",
          "items": { "type": "number", "minimum": 0 },
          "default": [500, 1000, 5000, 30000],
          "description": "Reconnect delay sequence"
        }
      },
      "additionalProperties": false
    },
    "heartbeatIntervalMs": {
      "type": "number",
      "default": 15000,
      "minimum": 5000,
      "maximum": 60000,
      "description": "Heartbeat interval in ms"
    },
    "permissions": {
      "type": "object",
      "properties": {
        "requireSuperhiveApproval": {
          "type": "array",
          "items": { "type": "string" },
          "default": ["file_delete", "command_execute", "sub_agent_spawn", "network_request"],
          "description": "Tool names requiring SuperHive approval"
        }
      },
      "additionalProperties": false
    }
  },
  "additionalProperties": false
}
```

---

## 4. Serialization Rules

### 4.1 JSON Rules

- All numbers are floats (no integers in JSON)
- Timestamps are Unix ms (not ISO strings)
- `null` is not allowed — use `{}` or omit the field
- Envelope `payload` must be an object or array — never a primitive

### 4.2 Type Mapping

| TypeScript | JSON | Notes |
|------------|------|-------|
| `string` | `"..."` | UTF-8 |
| `number` | `123` | JSON number (float) |
| `boolean` | `true`/`false` | |
| `string[]` | `["a", "b"]` | |
| `Record<string, unknown>` | `{...}` | |
| `unknown` | any JSON value | |
| `undefined` | *(omit)* | Never in JSON |

---

## 5. Schema Validation

### 5.1 Agent-Side Validation

The agent validates:
1. Incoming `SETTINGS_UPDATE` patch operations against JSON Patch spec
2. Incoming settings (after patch) against the `schema` provided in `SETTINGS_UPDATE`
3. Incoming `HOST_WELCOME` fields

The agent does NOT validate:
- Incoming message envelope structure (assumed valid from trusted host)
- Message types it doesn't understand (ignored)

### 5.2 Validation Libraries

- **JSON Schema**: `ajv` (recommended) or any JSON Schema draft-07 compliant validator
- **JSON Patch**: `fast-json-patch` or manual implementation (only 4 operations needed)

### 5.3 Validation Error Handling

| Error | Action |
|-------|--------|
| Patch operation invalid | Reject with `SETTINGS_REJECTED` |
| Settings fails schema | Reject with `SETTINGS_REJECTED` |
| Hash mismatch | Reject with `SETTINGS_REJECTED` |
| Unknown operation op | Reject with `SETTINGS_REJECTED` |

Always include specific `errors` array in rejection so host/UI can show what was wrong.
