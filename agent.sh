#!/bin/bash
# agent.sh — Portable entry point for the general v1 agent
#
# Works from any directory. Resolves its own absolute location and exports
# GENERAL_ROOT, GENERAL_STATE_DIR, etc. The folder this script lives in
# IS the agent's identity.
#
# Usage:
#   ./agent.sh                      # interactive session
#   ./agent.sh --offline            # offline mode
#   ./agent.sh --check              # validate config
#   ./agent.sh -p "say exactly: ok" # one-shot prompt
#   ./agent.sh --help               # show all flags
#
# First-run behavior:
#   - Generates a ULID stored in .general-v1/.identity (per-folder identity)
#   - Creates .general-v1/{sac,vectors,mission-control,audit} directories
#   - All agent state lives inside this folder
#
# Move or copy this folder anywhere on disk — the agent keeps its memory.

set -euo pipefail

# Resolve our own absolute path
AGENT_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export GENERAL_ROOT="$AGENT_SCRIPT_DIR"

# Source the paths helper for GENERAL_STATE_DIR etc.
# shellcheck disable=SC1091
source "$GENERAL_ROOT/meta-agent/paths.sh"

# First-run identity initialization (idempotent)
if [[ ! -f "$GENERAL_IDENTITY_FILE" ]]; then
  mkdir -p "$GENERAL_SAC_DIR" "$GENERAL_VECTORS_DIR" "$GENERAL_MC_DIR" "$GENERAL_AUDIT_DIR"

  # Generate ULID using node (already a dependency)
  if command -v node >/dev/null 2>&1 && [[ -d "$GENERAL_ROOT/node_modules/ulid" ]]; then
    NEW_ULID="$(cd "$GENERAL_ROOT" && node -e "console.log(require('ulid').ulid())")"
  else
    # Fallback: timestamp-based pseudo-ULID if ulid isn't available
    NEW_ULID="$(printf '%012x' "$(date +%s)" | tr 'a-f' 'A-F')-0000-0000-0000-000000000000"
  fi
  printf '%s' "$NEW_ULID" > "$GENERAL_IDENTITY_FILE"
  export GENERAL_IDENTITY="$NEW_ULID"
  echo "[agent] First-run: identity $NEW_ULID created at $GENERAL_IDENTITY_FILE"
fi

# Delegate to the meta-agent runner
exec "$GENERAL_ROOT/meta-agent/run.sh" "$@"
