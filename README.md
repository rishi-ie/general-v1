# General V1 — SuperHive Digital Employee

A **production-ready general-purpose digital employee** built on Pi Agent, deployed as a containerized host (SuperHive) with N Pi agents running inside, controlled via an Electron desktop app.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Your Desktop                                       │
│                                                     │
│  Electron App (superhive-electron/)                  │
│    └── Connects to ws://127.0.0.1:7711 (SuperHive) │
│        └── Authorization: Bearer <api-key>          │
└──────────────────────┬──────────────────────────────┘
                       │ WS + API key
                       │ ws://127.0.0.1:7711
┌──────────────────────▼──────────────────────────────┐
│  SuperHive Container (Docker)                        │
│                                                      │
│  ┌─ supervisord ──────────────────────────────────┐ │
│  │                                                  │ │
│  │  ┌─ superhive (host) ──────────────────────┐   │ │
│  │  │  ws://127.0.0.1:7711                     │   │ │
│  │  │  - Auth (static API key)                │   │ │
│  │  │  - Agent registry                       │   │ │
│  │  │  - Permission approval routing           │   │ │
│  │  │  - Inter-agent messaging                 │   │ │
│  │  │  - Presence tracking                     │   │ │
│  │  └──────────────────────────────────────────┘   │ │
│  │                                                  │ │
│  │  ┌─ pi-agent (general) ────────────────────┐   │ │
│  │  │  v1 modules:                            │   │ │
│  │  │  - communication (SuperHive bridge)     │   │ │
│  │  │  - mission-control (ticket auto-capture) │   │ │
│  │  │  - sub-agent-context (SAC memory)       │   │ │
│  │  │  - planning (task plan files)           │   │ │
│  │  │  - mem0 (persistent memory)            │   │ │
│  │  │  - browser (web browsing)               │   │ │
│  │  │  - permission (authority levels)        │   │ │
│  │  │  - sub-agent (spawn child agents)       │   │ │
│  │  │  v1/integrations:                       │   │ │
│  │  │  - mc-sac (turn_end → SAC goals)        │   │ │
│  │  │  - planning-mc (plan → SAC tasks)        │   │ │
│  │  │  - sac-subagent (SAC → subagent spawn)  │   │ │
│  │  │  - comm-perm (permission requests)      │   │ │
│  │  │  - comm-subagent (subagent state)        │   │ │
│  │  │  - comm-planning (phase tracking)        │   │ │
│  │  └──────────────────────────────────────────┘   │ │
│  │                                                  │ │
│  └──────────────────────────────────────────────────┘ │
│                                                      │
│  ~/.superhive/  (mounted volume)                     │
│    config.json                                       │
│    api_key                                           │
└─────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Build and run the container

```bash
# With docker-compose (recommended)
SUPERHIVE_API_KEY=your-key docker-compose up --build

# Or manually
docker build -t superhive .
docker run -p 7711:7711 \
  -v ~/.superhive:/root/.superhive \
  -e SUPERHIVE_API_KEY=your-key \
  superhive
```

On **first boot** (no `SUPERHIVE_API_KEY` set), a key is generated and printed:

```
==========================================
  SUPERHIVE API KEY (first boot)
==========================================

  XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

  This key is stored at ~/.superhive/api_key
==========================================
```

### 2. Run the Electron app

```bash
cd v1/superhive/electron
npm install
npm run dev
```

The Electron app connects to `ws://127.0.0.1:7711` using the stored API key (encrypted via `safeStorage` on macOS, stored in `~/Library/Application Support/superhive-electron/`).

### 3. Configure agents

Edit `agents.json` to define which Pi agents run inside the container:

```json
[
  {
    "name": "general",
    "type": "general",
    "enabled": true,
    "cwd": "/root",
    "env": {
      "SUPERHIVE_WS_URL": "ws://127.0.0.1:7711",
      "AGENT_MODEL": "claude-sonnet-4-5"
    },
    "config": {
      "metaAgentConfig": "/app/meta-agent/meta-agent-config/config.json",
      "piDir": "/app/pi"
    }
  }
]
```

## v1 Modules

| Module | Type | Purpose |
|--------|------|---------|
| `v1/identity/` | Skill | Name, role, principles, boundaries |
| `v1/docs/` | Skill | Command reference, JD, module table |
| `v1/planning/` | Extension + Skill | File-based task plans (`task_plan.md`) |
| `v1/browser/` | Extension + Skill | Web browsing via browser-use |
| `v1/mem0/` | Skill + Config | Persistent memory (@mem0/pi-agent-plugin) |
| `v1/mission-control/` | Extension + Skill | Ticket tracking, LLM auto-capture on turn_end |
| `v1/permission/` | Skill + Config | Authority levels (pi-permission-system) |
| `v1/sub-agent/` | Extension + Skill | Spawn child agents (nicobailon/pi-subagents) |
| `v1/sub-agent-context/` | Extension + Skill | Persistent memory, goals, decisions, lineage |
| `v1/communication/` | Extension + Skill | SuperHive bridge: WS client, settings sync, permissions, inter-agent messaging |
| `v1/superhive/` | Extension + Skill | SuperHive host: WS server, auth, registry, presence |

## v1 Integrations (cross-module wiring)

| File | Purpose |
|------|---------|
| `v1/integrations/mc-sac.ts` | Mission-control auto-capture → SAC goal entry (on turn_end) |
| `v1/integrations/planning-mc.ts` | `/ticket import` → parse task_plan.md → SAC goal updates |
| `v1/integrations/sac-subagent.ts` | SAC memory → subagent spawn orchestration |
| `v1/integrations/comm-perm.ts` | Sensitive tool calls → requestPermission() over WS → user prompt |
| `v1/integrations/comm-subagent.ts` | Push subagent spawn/status to SuperHive on tool_result |
| `v1/integrations/comm-planning.ts` | Push current phase/task to SuperHive via AGENT_STATE |

## Commands (from v1/docs/SKILL.md)

```
/ticket [description]     — Create a ticket (auto-assigned priority, status: open)
/ticket import             — Parse task_plan.md phases → create/update tickets
/permission <tool> <args>  — Request elevated permission (requires SuperHive approval)
/permission status         — Show active grants and pending requests
/mem0-search <query>       — Search persistent memory
/mem0-add <fact>           — Add a fact to persistent memory
/mem0-learn                — Digest recent conversation into memory
/plan                      — Show current task_plan.md summary
/plan next                 — Advance to next incomplete phase
/subagents-doctor          — Audit running subagents andSAC health
```

## Security

- **API key auth**: Single bearer token for all WebSocket connections to SuperHive
- **safeStorage**: API key encrypted via OS keychain (macOS Keychain, Windows DPAPI)
- **No TLS**: localhost-only deployment (not exposed to internet)
- **No multi-user**: Single API key, single user (personal tool)
- **Container isolation**: Agents run inside container with mounted `~/.superhive` volume

## Development

```bash
# Build Electron app
cd v1/superhive/electron
npm install
npm run build

# Build container without running
docker build -t superhive .

# Run container in foreground (see logs)
docker-compose up

# Run container detached
docker-compose up -d

# View container logs
docker-compose logs -f

# Open shell in running container
docker exec -it superhive /bin/bash
```

## Production Checklist

- [ ] Pi Agent boots with all v1 extensions loaded
- [ ] API key printed on first boot
- [ ] SuperHive rejects connections without valid API key
- [ ] Agent connects to SuperHive and sends AGENT_HELLO
- [ ] Agent sends AGENT_STATE every 30 seconds
- [ ] Permission request: agent → SuperHive → Electron → user → SuperHive → agent
- [ ] Agent auto-captures decisions as SAC goals (mc-sac integration)
- [ ] task_plan.md phases sync to SAC goals (planning-mc integration)
- [ ] Subagent spawn → SAC open loop + SuperHive state (sac-subagent + comm-subagent)
- [ ] Electron app launches without API key (prompts user)
- [ ] Electron app stores API key in safeStorage
- [ ] Electron shows connected agents in real-time
- [ ] Electron shows permission requests with approve/deny
- [ ] Inter-agent messaging works between agents
- [ ] Container survives agent crash (supervisord auto-restart)
