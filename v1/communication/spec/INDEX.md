# Communication Module — Specification Index

**Version**: 1.0.0
**Module**: `@general-v1/communication`
**Role**: SuperHive bridge — connects General V1 to the SuperHive host orchestrator
**Type**: Pi Agent Extension (WebSocket client)

---

## What This Module Does

The communication module is the **SuperHive bridge** — it connects a General V1 agent to a SuperHive host, enabling:

1. **Control plane** — SuperHive can push settings to the agent, request state, and send commands
2. **Permission routing** — sensitive agent actions require SuperHive approval
3. **Inter-agent messaging** — the agent can DM, broadcast, or group-message other agents via SuperHive
4. **Authority grants** — agent can grant/revoke authority to other agents
5. **Presence reporting** — agent reports online/away/busy status to SuperHive
6. **State streaming** — agent streams current task and metrics to SuperHive

---

## Specification Documents

| Document | Purpose |
|----------|---------|
| **[PROTOCOL.md](./PROTOCOL.md)** | **Start here.** Full WebSocket message reference — every message type, envelope format, direction, payload shape, and close codes. |
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | System design — how the two sides (agent ↔ host) interact, data flow diagrams, connection lifecycle, reconnection behavior. |
| **[SCHEMA.md](./SCHEMA.md)** | All data schemas — `AgentManifest`, `AgentState`, `SettingsPatch`, `InterAgentMessage`, `AuthorityGrant`, metrics, and JSON Schema for settings validation. |
| **[STATE.md](./STATE.md)** | All state machines — connection states, permission request lifecycle, settings sync states, presence states, authority grant lifecycle. |
| **[INTEGRATION.md](./INTEGRATION.md)** | How other modules (permission/, sub-agent/, mem0/, planning/, mission-control/) integrate with the communication module. |
| **[IMPLEMENTATION.md](./IMPLEMENTATION.md)** | How to implement the agent-side communication module from scratch — step-by-step guide with code surfaces and testing strategy. |
| **[CLI.md](./CLI.md)** | Command-line interface — flags, environment variables, configuration precedence. |

---

## Reading Order

For a new developer implementing this module:

1. **Start**: Read this index and the README in the parent folder
2. **Protocol**: Read `PROTOCOL.md` to understand every message
3. **Architecture**: Read `ARCHITECTURE.md` to understand how pieces connect
4. **Schemas**: Read `SCHEMA.md` for type definitions
5. **State**: Read `STATE.md` for all state machine transitions
6. **Integration**: Read `INTEGRATION.md` for how other modules hook in
7. **Implementation**: Read `IMPLEMENTATION.md` to build the module

---

## File Structure

```
v1/communication/
├── README.md                      # Overview + quick start
├── SUPERHIVE_README.md           # SuperHive host-side implementation guide
├── SPEC.md                        # This file
├── spec/                          # Detailed specifications
│   ├── INDEX.md                   # This file
│   ├── PROTOCOL.md                # WebSocket message reference
│   ├── ARCHITECTURE.md            # System design + data flow
│   ├── SCHEMA.md                  # Type definitions + JSON schemas
│   ├── STATE.md                   # State machines
│   ├── INTEGRATION.md             # Module integration guide
│   ├── IMPLEMENTATION.md          # Implementation guide
│   └── CLI.md                     # Command line interface
├── package.json
├── config.json                    # Default configuration
├── schema.json                    # Module manifest
└── extensions/
    └── communication/
        ├── index.ts               # Main entry point
        ├── websocket.ts           # WebSocket client
        ├── settings-store.ts      # Settings persistence + patch
        ├── types.ts              # Shared TypeScript types
        └── envelope.ts           # ID generation
```

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| WebSocket over HTTP | Bidirectional, low-latency, natural fit for real-time agent ↔ host communication |
| JSON text frames | Human-readable in devtools, easy to parse, sufficient for text-based protocol |
| JSON Patch for settings | Standard diff format, allows partial updates without full state replacement |
| SHA-256 hash for settings | Optimistic concurrency control — detect stale pushes |
| Exponential backoff reconnect | Prevents thundering herd on host restart, caps at 30s |
| Permission requests block | Agent cannot proceed without decision — fail-closed by default |
| ULID-style message IDs | Sortable, time-ordered, collision-resistant |
| 15s heartbeat | Balance between detecting failures quickly and network overhead |

---

## Protocol Version

Current protocol version: **`1`**

The protocol version is included in every envelope (`v: 1`). If the host or agent receives a frame with an unsupported version, it closes the connection with code `4400`.

Version history:
- `1` — initial version

---

## Relationship to SuperHive (Host Side)

This module is the **agent side** of a bidirectional protocol. The counterpart is **SuperHive** (`v1/superhive/`), which runs as a Pi Agent extension in an Electron desktop app and exposes a WebSocket server.

| Concern | This module (Agent) | SuperHive (Host) |
|---------|---------------------|-------------------|
| WebSocket role | Client (connects out) | Server (accepts in) |
| Port | outbound to `ws://host:7711` | inbound on `0.0.0.0:7711` |
| Lifecycle | Registers on connect | Validates and welcomes |
| Settings | Receives + applies | Pushes + validates |
| Permissions | Requests approval | Receives + routes to UI |
| Messaging | Sends + receives | Brokers + relays |
| Presence | Reports its own | Aggregates all |
| Authority | Grants to peers | Records + revokes |

See `SUPERHIVE_README.md` in the parent directory for the host-side specification.

---

## Status

**Implemented** — the code in `extensions/communication/` is a working reference implementation.

**Known limitations** (v2 scope):
- No TLS support (local connections only)
- No API key authentication (local trust)
- No file transfer over WebSocket
- No message compression
- Settings schema validation is basic (ajv, no custom validators)

---

## Maintainers

This module is part of General V1 (`/Users/rishi/work/general/v1/`).
For questions, refer to the specification documents above.
