# Changelog

All notable changes to general v1 are documented here.

## [1.0.0] — 2026-06-26

### Added

- **general v1** — fully functional CLI agent built on Pi Agent
- **12 integrated modules**: identity, docs, planning, browser, mem0, mission-control, permission, sub-agent, sub-agent-context, communication, superhive
- **6 cross-module integrations**: mc-sac, planning-mc, sac-subagent, comm-perm, comm-subagent, comm-planning
- **CLI launcher** (`./meta-agent/run.sh`) with auto-detect for 9 LLM providers including MiniMax
- **Offline mode**: all commands work without an API key; LLM calls stubbed gracefully
- **Containerized deployment**: Dockerfile + docker-compose with SuperHive WS host
- **Health check endpoint**: `GET /health` on port 7711
- **Quality gate**: smoke test, biome linting, GitHub Actions CI
- **Slash commands**: `/plan`, `/ticket`, `/mem0-search`, `/mem0-add`, `/permission`, `/subagents`, `/snapshot`, `/doctor`, `/exit`
- **MiniMax provider** with `MiniMax-M3` model support
- **Graceful fallback extensions** for mem0 and permission when plugins are not installed

### Fixed

- `mc-sac.ts`: `appendGoal` → `addGoal`
- `sac-subagent.ts`: `appendGoal` → `addGoal`; `pi.registerAction` → `pi.registerTool`
- `planning-mc.ts`: `updateGoal` call with correct `(goalId, updates)` signature
- `mission-control/runtime.ts`: `pi.cwd` → `ctx.cwd`; `getRecentTurns` → `getEntries().slice`
- Removed 4 placeholder stub extensions from config
- Docker container: `node:22-alpine`, `wget` for healthcheck, proper `COPY . /app`, npm ci for all modules
- `supervisord.conf`: removed invalid `[supervisor，一只]` section; added both `[program:superhive]` and `[program:general]`
- `entrypoint.sh`: removed broken python3 f-string, removed supervisord overwrite, fixed `exec supervisord`
- `websocket-server.ts`: added `GET /health` HTTP handler alongside WS upgrade
