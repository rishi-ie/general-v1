# Communication Module — CLI Reference

**Version**: 1.0.0
**Purpose**: Command-line interface, environment variables, and configuration precedence for the agent-side communication module.

---

## 1. Loading the Extension

The communication module is a Pi Agent extension. Load it via the Pi Agent CLI:

### 1.1 Via `--extension` Flag

```bash
pi --extension ./v1/communication/extensions/communication/index.ts
```

### 1.2 Via Config File

In `meta-agent-config/config.json`:

```json
{
  "extensions": [
    "v1/communication/extensions/communication/index.ts"
  ]
}
```

---

## 2. Environment Variables

Environment variables override config file values. They are checked at module startup.

### 2.1 Connection

| Variable | Default | Description |
|----------|---------|-------------|
| `SUPERHIVE_URL` | `ws://127.0.0.1:7711` | WebSocket URL of SuperHive host |
| `SUPERHIVE_API_KEY` | `""` | API key for authentication (v2) |

### 2.2 Behavior

| Variable | Default | Description |
|----------|---------|-------------|
| `SUPERHIVE_HB_INTERVAL_MS` | `15000` | Heartbeat interval in milliseconds |
| `SUPERHIVE_MAX_ATTEMPTS` | `-1` | Max reconnect attempts (`-1` = infinite) |
| `SUPERHIVE_DATA_DIR` | `~/.general-v1/communication` | Data directory for config and settings |

### 2.3 Logging

| Variable | Default | Description |
|----------|---------|-------------|
| `SUPERHIVE_LOG_LEVEL` | `info` | Log level (`debug`, `info`, `warn`, `error`) |
| `SUPERHIVE_PRETTY_LOG` | `true` | Pretty-print logs (for development) |

### 2.4 Example

```bash
SUPERHIVE_URL=wss://hive.example.com:7711 \
SUPERHIVE_API_KEY=my-secret-key \
SUPERHIVE_HB_INTERVAL_MS=20000 \
SUPERHIVE_LOG_LEVEL=debug \
pi --extension ./v1/communication/extensions/communication/index.ts
```

---

## 3. Configuration Files

### 3.1 Config File Location

The module reads configuration from:

```
~/.general-v1/communication/config.json
```

### 3.2 Schema File Location

The module manifest (sent on connect) is read from:

```
~/.general-v1/communication/schema.json
```

### 3.3 Settings File Location

Persisted module settings:

```
~/.general-v1/communication/settings.json
```

### 3.4 All Files

```
~/.general-v1/communication/
├── config.json     # Connection and behavior config
├── schema.json     # Module manifest (identity + capabilities)
└── settings.json   # Persisted module settings
```

---

## 4. Configuration Schema

### 4.1 `config.json`

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

### 4.2 `schema.json`

```json
{
  "name": "general-v1",
  "version": "1.0.0",
  "description": "General purpose digital employee",
  "capabilities": ["planning", "browser", "memory", "sub-agents"],
  "settingsSchema": {},
  "interAgent": {
    "acceptsDMs": true,
    "acceptsBroadcasts": true,
    "groups": ["general", "software", "research"]
  }
}
```

---

## 5. Configuration Precedence

Settings are loaded in this order (later overrides earlier):

1. **Default values** — hardcoded in the extension code
2. **Environment variables** — override defaults
3. **Config file** (`config.json`) — overrides environment variables
4. **Manifest file** (`schema.json`) — identity on connect

---

## 6. Pi Agent Flags

### 6.1 Relevant Pi Agent Flags

| Flag | Description |
|------|-------------|
| `--extension <path>` | Load an extension |
| `--skill <path>` | Load a skill markdown file |
| `--prompt <path>` | Load an extra prompt file |
| `--config <path>` | Use a specific config file |

### 6.2 Example: Full General V1 with Communication

```bash
pi \
  --extension ./v1/communication/extensions/communication/index.ts \
  --extension ./v1/permission/extensions/permission/index.ts \
  --extension ./v1/mem0/extensions/mem0/index.ts \
  --extension ./v1/sub-agent/extensions/sub-agent/index.ts \
  --skill ./v1/communication/SKILL.md \
  --skill ./v1/permission/SKILL.md \
  --skill ./v1/planning/SKILL.md \
  --config ./meta-agent-config/config.json
```

Or via config file (`meta-agent-config/config.json`):

```json
{
  "extensions": [
    "v1/communication/extensions/communication/index.ts",
    "v1/permission/extensions/permission/index.ts",
    "v1/mem0/extensions/mem0/index.ts",
    "v1/sub-agent/extensions/sub-agent/index.ts",
    "v1/planning/extensions/planning-with-files/index.ts"
  ],
  "skills": [
    "v1/communication/SKILL.md",
    "v1/permission/SKILL.md",
    "v1/planning/SKILL.md"
  ]
}
```

---

## 7. Debugging

### 7.1 Enable Debug Logging

```bash
SUPERHIVE_LOG_LEVEL=debug pi --extension ./v1/communication/extensions/communication/index.ts
```

### 7.2 Verbose WebSocket Frames

The module logs all sent/received messages at `debug` level:

```
[communication] connected to ws://127.0.0.1:7711
[communication] registered as agent-xyz
[communication] sent: AGENT_HELLO { ... }
[communication] received: HOST_WELCOME { ... }
[communication] sent: AGENT_STATE { ... }
[communication] sent: PERMISSION_REQUEST { ... }
[communication] received: PERMISSION_DECISION { ... }
```

### 7.3 Check Connection State

In the agent's code, you can check the WebSocket state:

```typescript
import { isConnected } from './v1/communication/extensions/communication/index.ts';

console.log('SuperHive connected:', isConnected());
```

### 7.4 Test Connection Manually

```bash
# Start SuperHive
cd v1/superhive/electron && npm run dev

# In another terminal, connect with wscat
npx wscat -c ws://127.0.0.1:7711

# You should see the connection established
# Then type:
# {"v":1,"type":"AGENT_HELLO","id":"test","ts":1234567890,"payload":{"manifest":{"name":"test","version":"1.0.0","capabilities":[],"settingsSchema":{}}}}
```

---

## 8. Troubleshooting

### 8.1 "Connection refused"

SuperHive is not running. Start it:
```bash
cd v1/superhive/electron && npm run dev
```

### 8.2 "Max reconnect attempts reached"

SuperHive is down for too long. Either restart SuperHive or increase `maxAttempts`:
```json
{ "reconnect": { "maxAttempts": 100 } }
```

### 8.3 "Permission request timeout"

SuperHive UI is not responding to permission requests. Check the SuperHive Electron app is open and the Permission tab shows pending requests.

### 8.4 "Settings rejected"

The settings pushed from SuperHive failed validation. Check the SuperHive logs and the agent's `settingsSchema` in the manifest.

### 8.5 "Protocol version mismatch"

The agent and SuperHive have mismatched protocol versions. Ensure both are at version `1`.

---

## 9. Quick Reference

```bash
# Minimal launch
pi --extension ./v1/communication/extensions/communication/index.ts

# With debug logging
SUPERHIVE_LOG_LEVEL=debug pi --extension ./v1/communication/extensions/communication/index.ts

# Connect to remote SuperHive
SUPERHIVE_URL=wss://hive.example.com:7711 pi --extension ./v1/communication/extensions/communication/index.ts

# With API key (v2)
SUPERHIVE_API_KEY=my-key pi --extension ./v1/communication/extensions/communication/index.ts

# Custom data directory
SUPERHIVE_DATA_DIR=/tmp/my-agent-data pi --extension ./v1/communication/extensions/communication/index.ts
```
