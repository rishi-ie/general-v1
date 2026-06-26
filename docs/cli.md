# general v1 — CLI Reference

## `./meta-agent/run.sh`

Main entry point. Requires Node 22.19+.

### Flags

| Flag | Description |
|------|-------------|
| `--offline` | Run without LLM. All commands work; LLM returns stub response. |
| `--check` | Validate config + extensions, print status, exit 0/1. |
| `--provider X` | Override auto-detected provider (e.g. `minimax`, `anthropic`). |
| `--model Y` | Override auto-detected model (e.g. `MiniMax-M3`, `claude-sonnet-4-5`). |
| `--cwd DIR` | Set working directory for the agent session. |
| `--no-superhive` | Skip SuperHive WS client connection. |
| `-p "prompt"` | One-shot prompt mode. Runs non-interactively and exits. |
| `-n "name"` | Set session display name. |
| `-h`, `--help` | Print help and exit. |

### Environment Variables

#### LLM Providers

| Variable | Provider | Default Model |
|----------|----------|--------------|
| `MINIMAX_API_KEY` | MiniMax | `MiniMax-M3` |
| `ANTHROPIC_API_KEY` | Anthropic | `claude-sonnet-4-5` |
| `GEMINI_API_KEY` | Google Gemini | `gemini-2.5-flash` |
| `OPENAI_API_KEY` | OpenAI | `gpt-4o` |
| `DEEPSEEK_API_KEY` | DeepSeek | `deepseek-chat` |
| `GROQ_API_KEY` | Groq | `llama-3.3-70b-versatile` |
| `MISTRAL_API_KEY` | Mistral | `mistral-large-latest` |
| `OPENROUTER_API_KEY` | OpenRouter | `anthropic/claude-3.5-sonnet` |
| `TOGETHER_API_KEY` | Together AI | `meta-llama/Llama-3.3-70B-Instruct` |

Provider auto-detection order: minimax, anthropic, google, openai, deepseek, groq, mistral, openrouter, together.

#### Agent Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `SUPERHIVE_WS_URL` | `ws://127.0.0.1:7711` | SuperHive WS host URL |
| `PI_OFFLINE` | unset | Set to `1` for offline mode |
| `PI_SKIP_VERSION_CHECK` | unset | Set to `1` to skip version check |

## Slash Commands

### Planning

```
/plan                     Show current task_plan.md summary
/plan next               Advance to next incomplete phase
```

### Tickets

```
/ticket <description>    Create a ticket (auto-assigned priority, status: open)
/ticket list             List all tickets
/ticket show <id>         Show ticket details
/ticket update <id> [--status open|in_progress|done] [--priority low|medium|high|critical]
/ticket close <id>        Close a ticket
/ticket delete <id>       Delete a ticket
/ticket import           Parse task_plan.md phases → tickets
/ticket link-plan <id> <phase>   Link ticket to a plan phase
/ticket confirm <key>    Confirm auto-detected task
```

### Permissions

```
/permission <tool> <args>  Request elevated permission (requires SuperHive)
/permission status         Show active grants and pending requests
```

### Sub-Agents

```
/subagents               List active sub-agents
/subagents-doctor        Audit running subagents and SAC health
```

### System

```
/snapshot                Generate cognitive snapshot
/superhive               SuperHive WS host status
/doctor                  Full system health check
/exit                    Quit
/help                    List all available commands
```

## Docker

### Environment Variables

```bash
MINIMAX_API_KEY=...           # Required for LLM responses
SUPERHIVE_API_KEY=...         # Optional; auto-generated on first boot if unset
PI_OFFLINE=1                  # Run in offline mode
```

### Endpoints

- `ws://localhost:7711` — SuperHive WS host
- `GET http://localhost:7711/health` — Health check (returns `{"status":"ok"}`)

## Configuration

Configuration is in `meta-agent/meta-agent-config/`:

- `config.json` — Extensions, skills, prompts, model routing
- `auth.json` — API keys (copy from `auth.json.example`)
- `settings.json` — Provider and model defaults
- `skills/` — Constitutions, personas, domain skills
- `prompts/` — Extra system instructions
- `extensions/` — Custom TypeScript extensions

## Offline Mode

When run with `--offline` or `PI_OFFLINE=1`:

- Agent boots with all commands registered
- Planning, tickets, SAC memory, sub-agents all work
- LLM calls return a placeholder: `[no LLM configured — set MINIMAX_API_KEY or ANTHROPIC_API_KEY]`
- SuperHive client gracefully no-ops

## File Locations

| Path | Purpose |
|------|---------|
| `~/.pi/agent/` | Pi agent state (sessions, settings, auth) |
| `~/.superhive/` | SuperHive data (API key, audit logs) |
| `./task_plan.md` | Current task plan |
| `./.planning/` | Plan phases directory |
| `./tickets.json` | Mission-control ticket store |
| `./sac/` | Sub-agent-context state |
