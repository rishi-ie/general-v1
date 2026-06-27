# general-v1

A portable, self-contained CLI agent built on [Pi Agent](https://github.com/earendil-works/pi). One folder is one agent with its own identity, memory, and state. Ships with 12 integrated modules for planning, persistent cognitive memory, ticket tracking, sub-agent orchestration, semantic vector search, permissions, and multi-agent coordination via SuperHive.

## Features

- **12 integrated modules** — identity, docs, planning, browser, lancedb, mission-control, permission, sub-agent, sub-agent-context, communication, superhive
- **7 cross-module integrations** — auto-capture decisions, sync plans, spawn sub-agents, route permissions, push state
- **9 LLM providers** — MiniMax, Anthropic, Google, OpenAI, DeepSeek, Groq, Mistral, OpenRouter, Together AI; auto-detected from env
- **Portable** — one folder = one agent identity (ULID). Package as `.tar.gz`, extract anywhere, run
- **Offline mode** — all commands work without an API key; LLM calls stubbed gracefully
- **Persistent cognitive memory** — SAC (sub-agent-context) tracks identity, goals, decisions, open loops, and lineage epochs
- **Semantic vector search** — LanceDB hybrid search (vector + full-text) over decisions, epochs, events
- **File-based planning** — task_plan.md with SHA-256 attestation, Manus-style phases, 2-action rule
- **Sub-agent orchestration** — spawn 8 builtin agents (scout, researcher, planner, worker, reviewer, oracle, delegate, context-builder) or custom agents; parallel, chained, and background runs
- **SuperHive coordination** — WebSocket bridge to SuperHive host; permission routing, inter-agent messaging, presence, state streaming

## Quick Start

```bash
# 1. Clone and install
git clone <repo-url> general-v1
cd general-v1
npm install

# 2. Add your API key (any of these env vars auto-detected)
export MINIMAX_API_KEY=your-key   # MiniMax (priority 1)

# 3. Run
./meta-agent/run.sh                # Interactive CLI
./meta-agent/run.sh -p "hello"    # One-shot prompt
./meta-agent/run.sh --offline     # Offline mode (no API key needed)
./meta-agent/run.sh --check       # Validate config + extensions

# 4. Package as portable (optional)
./meta-agent/package.sh my-agent /tmp/my-agent
# → dist/my-agent.tar.gz
# Extract anywhere and run:
#   tar -xzf dist/my-agent.tar.gz -C ~/agents
#   cd ~/agents/my-agent && ./agent.sh -p "hello"
```

## Architecture

```
general-v1 Agent Folder (one folder = one agent)
│
├── agent.sh                  Portable entry point
│   └── meta-agent/run.sh     Provider auto-detect, Pi bootstrap
│       └── meta-agent/pi/pi-test.sh   Pi Agent runtime
│
└── .general-v1/              Per-agent state (ULID identity, memory, tickets)
    ├── .identity              ULID — folder's unique identity
    ├── sac/                   Sub-agent-context: decisions, goals, lineage
    ├── vectors/               LanceDB: decisions.lance, epochs.lance,
    │                           events.lance, snapshots.lance
    ├── mission-control/       Tickets: open, in-progress, done JSON
    ├── audit/                 Audit logs
    └── communication/         SuperHive settings store
        │
        │ ws://127.0.0.1:7711
        │ AGENT_HELLO, AGENT_STATE (30s), HEARTBEAT (15s),
        │ PERMISSION_REQUEST, INTER_AGENT_MESSAGE, etc.
        ▼
┌──────────────────────────────────────────────────────────────────┐
│ Pi Agent (14 extensions loaded)                                  │
│                                                                  │
│  ┌────────────────────┐  ┌────────────────────┐                  │
│  │ planning-with-files│  │  mission-control   │                  │
│  │ task_plan.md       │  │  tickets JSON       │                  │
│  │ findings.md        │  │                     │                  │
│  └────────────────────┘  └────────────────────┘                  │
│  ┌────────────────────┐  ┌────────────────────┐                  │
│  │ sub-agent          │  │  sub-agent-context │                  │
│  │ 8 builtin agents   │  │  SAC cognitive      │                  │
│  │ + custom agents    │  │  snapshot, goals    │                  │
│  └────────────────────┘  └────────────────────┘                  │
│  ┌────────────────────┐  ┌────────────────────┐                  │
│  │ lancedb            │  │  communication     │                  │
│  │ hybrid vector+FTS   │  │  WS client :7711   │                  │
│  │ 4 Lance tables     │  │                    │                  │
│  └────────────────────┘  └────────────────────┘                  │
│  ┌────────────────────┐  ┌────────────────────┐                  │
│  │ superhive (host)   │  │  pi-permission-sys │                  │
│  │ WS :7711, registry│  │  policy allow/ask  │                  │
│  └────────────────────┘  └────────────────────┘                  │
│                                                                  │
│  + 7 integrations: mc-sac, planning-mc, sac-subagent,           │
│    comm-perm, comm-subagent, comm-planning, sac-lancedb         │
└──────────────────────────────────────────────────────────────────┘
                          │
                          ▼ ws://127.0.0.1:7711
┌──────────────────────────────────────────────────────────────────┐
│ SuperHive Host (Electron desktop app, localhost-only for v1)     │
│   WebSocket server · Agent registry · Permission router          │
│   Inter-agent broker · Presence tracker · Authority manager      │
│   Persistence: ~/.superhive/ (JSON + daily jsonl logs)          │
└──────────────────────────────────────────────────────────────────┘
```

## Modules

| Module | Purpose | Storage |
|--------|---------|---------|
| `v1/identity/` | Name, role, principles, boundaries | — |
| `v1/docs/` | Command reference, agent self-description | — |
| `v1/planning/` | File-based plans (task_plan.md), SHA-256 attestation | `task_plan.md`, `findings.md`, `progress.md` |
| `v1/browser/` | Browser automation via [browser-use](https://github.com/browser-use/browser-use) | `~/.config/v1/browser-profiles/` |
| `v1/lancedb/` | Hybrid vector + full-text semantic memory | `.general-v1/vectors/` |
| `v1/mission-control/` | Ticket tracking with LLM auto-capture | `.general-v1/mission-control/` |
| `v1/permission/` | Policy-based tool/bash permissions | — |
| `v1/sub-agent/` | Spawn child agents (builtin + custom) | — |
| `v1/sub-agent-context/` | SAC: persistent memory, goals, decisions, lineage | `.general-v1/sac/` |
| `v1/communication/` | SuperHive WS client | `.general-v1/communication/` |
| `v1/superhive/` | SuperHive host (registry, broker, permissions) | `~/.superhive/` |
| `v1/integrations/` | Cross-module wiring (7 files) | — |

## Integrations

| File | Connects | What it does |
|------|----------|--------------|
| `mc-sac.ts` | mission-control → sac | Auto-creates SAC goals from task-intent phrases on turn_end |
| `planning-mc.ts` | planning → sac | Syncs task_plan.md phases to SAC goals with progress tracking |
| `sac-subagent.ts` | sac → sub-agent | Tracks sub-agent spawns as open loops in SAC |
| `comm-perm.ts` | communication → permission | Routes sensitive tool calls to SuperHive for approval |
| `comm-subagent.ts` | sub-agent → communication | Pushes sub-agent status to SuperHive state |
| `comm-planning.ts` | planning → communication | Pushes current plan phase to SuperHive state |
| `sac-lancedb.ts` | sac → lancedb | Syncs SAC decisions to LanceDB; routes memory questions to vector search |

## Slash Commands

**Tickets** (`/ticket *`)

| Command | Description |
|---------|--------------|
| `/ticket new <title>` | Create a ticket |
| `/ticket list` | List all tickets |
| `/ticket show <id>` | Show ticket details |
| `/ticket update <id>` | Update ticket fields |
| `/ticket close <id>` | Close a ticket |
| `/ticket delete <id>` | Delete a ticket |
| `/ticket link-plan <id> <phase>` | Link ticket to a plan phase |
| `/ticket import` | Import open phases from task_plan.md as tickets |
| `/ticket confirm <key>` | Confirm an auto-detected task |

**Semantic Memory** (`/semantic-*`)

| Command | Description |
|---------|--------------|
| `/semantic-search <query>` | Search indexed decisions, epochs, events |
| `/semantic-add <fact>` | Manually add a fact to memory |
| `/semantic-tour` | Browse all indexed records |
| `/semantic-status` | Show memory status and statistics |
| `/semantic-forget <query>` | Delete records matching a query |

**Planning** (`/plan-*`)

| Command | Description |
|---------|--------------|
| `/plan-status` | Show current plan status |
| `/plan-attest` | Run attest-plan helper (--show / --clear) |
| `/plan-goal` | Set or clear plan completion goal |
| `/plan-loop` | Start/stop planning loop ticks (default: 10m) |

**Sub-agents** (`/run`, `/chain`, `/parallel`, `/subagents-doctor`)

| Command | Description |
|---------|--------------|
| `/run <agent> <task>` | Run a sub-agent directly |
| `/chain <agents...>` | Run agents in sequence |
| `/run-chain <name>` | Run a saved chain |
| `/parallel <agents...>` | Run agents in parallel |
| `/subagents-doctor` | Show sub-agent diagnostics |

**Pi core** — `/exit`, `/help` are provided by Pi Agent.

## CLI Flags

```
./meta-agent/run.sh [flags]
  --offline         Run without LLM (all commands work; responses stubbed)
  --check           Validate config + extensions, exit 0/1
  --provider X      Override auto-detected provider (minimax, anthropic, etc.)
  --model Y         Override auto-detected model (MiniMax-M3, claude-sonnet-4-5, etc.)
  --cwd DIR         Set working directory for the session
  --no-superhive    Skip SuperHive WS client connection
  -p "prompt"       One-shot prompt (non-interactive)
  -n "name"         Session display name
  -h, --help        Print help
```

## Environment Variables

**LLM Providers** (set any; first non-empty wins auto-detection order below)

| Variable | Provider | Default model |
|----------|----------|---------------|
| `MINIMAX_API_KEY` | MiniMax | MiniMax-M3 |
| `ANTHROPIC_API_KEY` | Anthropic | claude-sonnet-4-5 |
| `GEMINI_API_KEY` | Google Gemini | gemini-2.5-flash |
| `OPENAI_API_KEY` | OpenAI | gpt-4o |
| `DEEPSEEK_API_KEY` | DeepSeek | deepseek-chat |
| `GROQ_API_KEY` | Groq | llama-3.3-70b-versatile |
| `MISTRAL_API_KEY` | Mistral | mistral-large-latest |
| `OPENROUTER_API_KEY` | OpenRouter | anthropic/claude-3.5-sonnet |
| `TOGETHER_API_KEY` | Together AI | meta-llama/Llama-3.3-70B |

**SuperHive**

| Variable | Default | Description |
|----------|---------|-------------|
| `SUPERHIVE_WS_URL` | `ws://127.0.0.1:7711` | SuperHive WS host URL |
| `SUPERHIVE_API_KEY` | — | API key for SuperHive auth |

**Pi Agent**

| Variable | Description |
|----------|-------------|
| `PI_OFFLINE=1` | Equivalent to `--offline` |
| `PI_SKIP_VERSION_CHECK=1` | Skip Pi version check |

**Portable agent** (set by `agent.sh` / `meta-agent/paths.sh`)

| Variable | Description |
|----------|-------------|
| `GENERAL_ROOT` | Absolute path to agent folder |
| `GENERAL_STATE_DIR` | `$GENERAL_ROOT/.general-v1` |
| `GENERAL_SAC_DIR` | `$GENERAL_STATE_DIR/sac` |
| `GENERAL_VECTORS_DIR` | `$GENERAL_STATE_DIR/vectors` |
| `GENERAL_MC_DIR` | `$GENERAL_STATE_DIR/mission-control` |

## Storage

| Path | What it holds |
|------|--------------|
| `.general-v1/.identity` | ULID — this folder's unique agent identity |
| `.general-v1/sac/` | SAC cognitive state: decisions, goals, open loops, lineage epochs |
| `.general-v1/vectors/` | LanceDB `.lance` tables: decisions, epochs, events, snapshots |
| `.general-v1/mission-control/` | Ticket JSON files: open, in-progress, done |
| `.general-v1/audit/` | Audit logs |
| `.general-v1/communication/` | SuperHive settings store |

All paths are relative to the agent folder in portable mode. Legacy `~/.general-v1/` paths still work for existing users.

## Testing

```bash
./scripts/smoke.sh              # 4/4: config validation, offline boot, extensions, skills
bash scripts/test-portable.sh   # 7/7: build, extract, identity gen, copy/move preserves identity
npm run smoke                   # Same as ./scripts/smoke.sh
```

## Documentation

| File | What it covers |
|------|---------------|
| `docs/cli.md` | Full CLI reference: all flags, env vars, slash commands |
| `docs/portable.md` | Portable packaging guide: identity model, path resolution, packaging |
| `v1/*/README.md` | Per-module documentation (lancedb, mission-control, planning, etc.) |
| `v1/*/SKILL.md` | Skill definitions for each module |
| `v1/superhive/docs/PROTOCOL.md` | Full SuperHive WebSocket protocol reference |
| `v1/communication/SUPERHIVE_README.md` | SuperHive host architecture + protocol |
| `meta-agent/AGENTS.md` | Meta-agent framework: extensions, skills, prompts, events |
| `meta-agent/architecture.md` | Meta-agent technical architecture |

## Requirements

- **Node.js 22.19+**
- **Python 3** (optional — only needed for the browser module)
- An API key for at least one supported LLM provider

## Removed

- **Docker** — use `./meta-agent/package.sh` for portable packaging instead
- **mem0** — replaced by `v1/lancedb/` (LanceDB semantic memory)
- **CI pipelines** — no GitHub Actions or other CI; run `./scripts/smoke.sh` locally
