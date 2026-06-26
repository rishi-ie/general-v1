# Portable Agent Usage

The general v1 agent can be packaged as a single self-contained folder that runs anywhere on disk.

## Quick Start

```bash
# Build a portable package (from the repo)
./meta-agent/package.sh my-agent /tmp/my-agent
# Produces: dist/my-agent.tar.gz

# Extract anywhere
mkdir -p ~/agents && cd ~/agents
tar -xzf /path/to/my-agent.tar.gz
cd my-agent

# Run
./agent.sh -p "say exactly: ok"
```

The first run generates a unique identity (ULID) stored in `.general-v1/.identity`. Move or copy the folder freely — the identity persists with the folder.

## Folder Layout

```
my-agent/
├── agent.sh                      # Single entry point (self-resolving)
├── package.json, package-lock.json, node_modules/   # All npm deps bundled
├── meta-agent/                   # Agent runtime
│   ├── paths.sh                  # Path resolution helper
│   ├── run.sh, setup.sh
│   └── meta-agent-config/
├── pi/                           # Pi Agent clone + deps (bundled)
├── v1/                           # All agent modules (real files, no symlinks)
├── integrations/                 # Cross-module integrations
├── scripts/                      # Smoke + portable tests
└── .general-v1/                  # Created on first run (per-folder state)
    ├── .identity                 # ULID — folder's unique identity
    ├── sac/                      # SAC persistent state
    ├── vectors/                  # LanceDB vector storage
    ├── mission-control/          # Ticket store
    └── audit/                    # SuperHive audit logs
```

## Identity Model

- **One folder = one agent identity**
- Each folder has a unique ULID (Universally Unique Lexicographically Sortable Identifier)
- Two folders with identical contents but separate `.general-v1/` directories are **two distinct agents** with separate memories
- Copy/move folder → identity preserved (same ULID inside)
- Delete `.general-v1/` and rerun → fresh identity generated

## Path Resolution

All paths resolve relative to the folder containing `agent.sh`:

| Config value | Resolves to |
|---|---|
| `./.general-v1/sac/` | `<folder>/.general-v1/sac/` |
| `./.general-v1/vectors/` | `<folder>/.general-v1/vectors/` |
| `./.general-v1/mission-control/` | `<folder>/.general-v1/mission-control/` |

The agent sets `GENERAL_ROOT` env var at startup pointing to its own absolute location. All TS modules resolve paths via `expandPath()` / `resolveStoragePath()` helpers that honor `GENERAL_ROOT`.

The legacy `~/.general-v1/` location still works for users with existing setups — if a config has `"storagePath": "~/.general-v1/sac"`, it expands to `$HOME/.general-v1/sac` as before.

## Building Packages

```bash
# Default name and location
./meta-agent/package.sh
# → dist/general-v1-portable.tar.gz

# Custom
./meta-agent/package.sh my-research-agent /tmp/output
# → dist/my-research-agent.tar.gz
```

The build script:
1. Copies source files (excludes `.git/`, `dist/`, runtime caches)
2. Bundles `node_modules/` and Pi agent + its deps
3. Resolves all symlinks to real files (zero symlink fragility)
4. Makes scripts executable
5. Creates `.tar.gz` in `dist/`

## Testing

```bash
# Run smoke tests (4/4)
./scripts/smoke.sh

# Run portable tests (7/7)
bash scripts/test-portable.sh

# Tests:
# 1. Package builds from source
# 2. ./agent.sh --check passes in package
# 3. Smoke tests pass in package
# 4. Identity generates on first run
# 5. Copying folder preserves identity
# 6. Moving folder preserves identity
# 7. Fresh copy gets a distinct identity
```

## How It Differs From The Original

Before this feature, the agent had scattered state:
- `~/.general-v1/vectors/` for LanceDB
- `~/.general-v1/sac/` for SAC state
- `./.mission-control/` for tickets (relative to cwd)
- Hardcoded symlinks in `meta-agent/meta-agent-config/v1/` → `../../../v1/`

After this feature, everything lives inside the agent folder. The folder is fully self-contained:
- No dependency on `$HOME`
- No dependency on original install location
- No dependency on the cwd
- LanceDB vectors, SAC state, tickets, audit logs — all inside `.general-v1/`

## Cloud-Deployable

The folder is structured to support cloud deployment:
- Replace `./.general-v1/vectors/` with `s3://bucket/path/` in `v1/lancedb/config.json`
- LanceDB OSS supports `s3://`, `gs://`, `az://` natively
- Path resolvers already handle non-filesystem URIs (no special handling needed)

(Future work — current implementation only uses local filesystem.)

## Out of Scope (for v1)

- Cloud storage backends (s3:// for LanceDB) — local FS only for now
- Auto-update mechanism from a remote registry
- Encrypted state storage
- Multi-agent folders running concurrently with shared code (works, but no shared state)
