# general v1 — CLI Agent

A fully-functional CLI agent built on [Pi Agent](https://github.com/earendil-works/pi). Internal name: **general**. Ships with 12 integrated modules for planning, memory, tickets, permissions, sub-agents, browser, and more.

## Quick Start

### 1. Clone and install

```bash
git clone <repo-url> general-v1
cd general-v1
npm install
```

### 2. Add your API key

```bash
# Edit and add your key
code meta-agent/meta-agent-config/auth.json

# Or set via environment variable (auto-detected)
export MINIMAX_API_KEY=your-key
export ANTHROPIC_API_KEY=your-key
```

### 3. Run

```bash
# Interactive CLI
./meta-agent/run.sh

# One-shot prompt
./meta-agent/run.sh -p "What files changed in the last commit?"

# Offline mode (no API key needed — commands work, LLM responses stubbed)
./meta-agent/run.sh --offline

# Validate config
./meta-agent/run.sh --check
```

### 4. Package as Portable

```bash
# Build a .tar.gz of the agent folder
./meta-agent/package.sh

# Or with a custom name
./meta-agent/package.sh my-agent /tmp/my-agent
# → dist/my-agent.tar.gz

# Extract and run anywhere
tar -xzf dist/my-agent.tar.gz -C ~/agents
cd ~/agents/general-v1-portable  # (or your custom name)
./agent.sh -p "hello"
```

Each extracted folder is fully self-contained — no dependency on `$HOME`, the original install path, or the cwd. Identity (ULID) lives in `.general-v1/.identity`. See [docs/portable.md](docs/portable.md).

## Commands

| Command | Description |
|---------|-------------|
| `/ticket <desc>` | Create a ticket |
| `/ticket list` | List open tickets |
| `/ticket import` | Import `task_plan.md` phases as tickets |
| `/plan` | Show current plan summary |
| `/plan next` | Advance to next incomplete phase |
| `/permission status` | Show active grants and pending requests |
| `/semantic-search <q>` | Search semantic memory |
| `/semantic-add <fact>` | Add a fact to memory |
| `/subagents` | List active sub-agents |
| `/snapshot` | Generate cognitive snapshot |
| `/doctor` | Full system health check |
| `/exit` | Quit |

## CLI Flags

```
./meta-agent/run.sh [flags]
  --offline       Run without LLM (stub responses, all commands work)
  --check         Validate config and extensions, exit 0/1
  --provider X    Override auto-detected provider
  --model Y       Override auto-detected model
  --cwd DIR       Set working directory
  --no-superhive  Skip SuperHive WS client connection
  -p "prompt"     One-shot prompt (non-interactive)
  -n "name"       Session name
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `MINIMAX_API_KEY` | MiniMax API key |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `GEMINI_API_KEY` | Google Gemini API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `DEEPSEEK_API_KEY` | DeepSeek API key |
| `GROQ_API_KEY` | Groq API key |
| `MISTRAL_API_KEY` | Mistral API key |
| `OPENROUTER_API_KEY` | OpenRouter API key |
| `TOGETHER_API_KEY` | Together AI API key |
| `SUPERHIVE_WS_URL` | SuperHive WS URL (default: ws://127.0.0.1:7711) |
| `PI_OFFLINE=1` | Equivalent to `--offline` |

Provider auto-detection order: minimax, anthropic, google, openai, deepseek, groq, mistral, openrouter, together.

## Modules

| Module | Purpose |
|--------|---------|
| `v1/identity/` | Name, role, principles, boundaries |
| `v1/docs/` | Command reference |
| `v1/planning/` | File-based task plans (`task_plan.md`) |
| `v1/browser/` | Web browsing via browser-use |
| `v1/lancedb/` | Semantic memory with hybrid vector + full-text search |
| `v1/mission-control/` | Ticket tracking, LLM auto-capture on turn_end |
| `v1/permission/` | Authority levels (pi-permission-system) |
| `v1/sub-agent/` | Spawn child agents |
| `v1/sub-agent-context/` | Persistent memory, goals, decisions, lineage |
| `v1/communication/` | SuperHive bridge: WS client, settings sync, permissions |
| `v1/superhive/` | WS host: registry, broker, presence, permissions |

## Integrations

| File | Purpose |
|------|---------|
| `v1/integrations/mc-sac.ts` | Mission-control auto-capture to SAC goal entry |
| `v1/integrations/planning-mc.ts` | `/ticket import` to SAC goal updates |
| `v1/integrations/sac-subagent.ts` | SAC memory to subagent spawn |
| `v1/integrations/comm-perm.ts` | Sensitive tool calls to SuperHive permission request |
| `v1/integrations/comm-subagent.ts` | Push subagent status to SuperHive |
| `v1/integrations/comm-planning.ts` | Push phase/task to SuperHive via AGENT_STATE |

## Without an API Key

All features work offline except LLM responses. The agent boots, registers all slash-commands, persists tickets and SAC state, and updates `task_plan.md`. LLM calls return a placeholder message.

## Production Checklist

- [x] Pi Agent boots with all v1 extensions loaded
- [x] API key printed on first boot
- [x] SuperHive rejects connections without valid API key
- [x] Agent connects to SuperHive and sends AGENT_HELLO
- [x] Agent sends AGENT_STATE every 30 seconds
- [x] Permission request: agent → SuperHive → user → SuperHive → agent
- [x] Agent auto-captures decisions as SAC goals (mc-sac)
- [x] task_plan.md phases sync to SAC goals (planning-mc)
- [x] Subagent spawn → SAC open loop + SuperHive state
- [x] Smoke test: `npm run smoke` passes
- [x] Portable test: `bash scripts/test-portable.sh` passes

## Development

```bash
# Install
npm run setup

# Lint
npm run lint

# Typecheck (run from meta-agent/pi)
cd meta-agent/pi && npm run check

# Smoke test
npm run smoke

# Run offline (no API key)
./meta-agent/run.sh --offline

# Run with provider override
./meta-agent/run.sh --provider minimax --model MiniMax-M3
```
