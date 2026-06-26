# Changelog

All notable changes to general v1 are documented here.

## [Unreleased]

### Added

- **Portable agent packaging**: Agent can be packaged as a single self-contained folder that runs anywhere on disk. New `./agent.sh` entry point self-resolves its absolute path and exports `GENERAL_ROOT` env var. All storage paths (`~/.general-v1/sac/`, `~/.general-v1/vectors/`, `~/.mission-control/`) replaced with relative paths inside the folder (`./.general-v1/sac/`, `./.general-v1/vectors/`, `./.general-v1/mission-control/`). Each folder gets a unique identity (ULID in `.general-v1/.identity`) generated on first run. Copy/move folder = identity preserved; delete `.general-v1/` = fresh identity. New `meta-agent/paths.sh` is the single source of truth for path resolution; all TS modules updated with `expandPath()` / `resolveStoragePath()` helpers that honor `GENERAL_ROOT` and fall back to legacy `~/.general-v1/` paths for existing users.

- **`meta-agent/package.sh`**: Build script that creates a `.tar.gz` of the agent folder with all `node_modules/` and Pi agent bundled. Resolves symlinks to real files. Default output: `dist/general-v1-portable.tar.gz`.

- **`scripts/test-portable.sh`**: 7-step test that verifies build → extract → run → identity generation → copy preserves identity → move preserves identity → fresh copy gets distinct identity. All 7 PASS.

- **LanceDB module** (`v1/lancedb/`): Semantic memory layer using embedded LanceDB vector search. Provides hybrid vector + full-text search over indexed decisions, epochs, agent responses, and tool results. Auto-indexes SAC events when provider API is available (MiniMax, OpenAI, Anthropic, or Voyage). Exposes `/semantic-search`, `/semantic-add`, `/semantic-tour`, `/semantic-status`, `/semantic-forget` commands and a `semantic_search` tool callable by the LLM. Provider auto-detected from `MINIMAX_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `VOYAGE_API_KEY`. Online-only (disables gracefully in `--offline` mode).

### Removed

- **mem0 module** (`v1/mem0/`): Long-term semantic memory module removed entirely. `Mem0Memory` type, `mem0Enabled` config, `mem0_memories` retrieval context, and all `searchMemories`/`addMemory`/`initMem0Bridge` calls removed from SAC.

- **Docker containerization**: `Dockerfile`, `docker-compose.yml`, `entrypoint.sh`, `supervisord.conf`, `.dockerignore` removed. Container healthcheck and `GET /health` endpoint no longer available. CI pipeline references removed. Docker is no longer a supported deployment method — use portable packaging (`./meta-agent/package.sh`) instead.

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
