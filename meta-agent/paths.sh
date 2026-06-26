#!/bin/bash
# paths.sh — Single source of truth for portable agent paths
# Sources all GENERAL_* environment variables based on the folder this script lives in.
#
# Usage:
#   source /path/to/meta-agent/paths.sh
#
# Exports:
#   GENERAL_ROOT         — absolute path to the agent folder (self-resolving)
#   GENERAL_STATE_DIR    — $GENERAL_ROOT/.general-v1
#   GENERAL_SAC_DIR      — $GENERAL_STATE_DIR/sac
#   GENERAL_VECTORS_DIR  — $GENERAL_STATE_DIR/vectors
#   GENERAL_MC_DIR       — $GENERAL_STATE_DIR/mission-control
#   GENERAL_AUDIT_DIR    — $GENERAL_STATE_DIR/audit
#   GENERAL_IDENTITY     — contents of $GENERAL_STATE_DIR/.identity (ULID)
#   GENERAL_IDENTITY_FILE — absolute path to .identity file
#   GENERAL_CONFIG_DIR   — $GENERAL_ROOT/meta-agent/meta-agent-config

# Resolve the directory containing this file (works whether sourced or executed)
if [[ -n "${BASH_SOURCE[0]:-}" ]]; then
  _PATHS_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
else
  _PATHS_SCRIPT_DIR="$(pwd)"
fi

# Walk up to find the agent root (the folder containing meta-agent/)
# This handles the case where paths.sh is at meta-agent/paths.sh
if [[ -d "$_PATHS_SCRIPT_DIR/.." ]] && [[ -f "$_PATHS_SCRIPT_DIR/../package.json" ]]; then
  export GENERAL_ROOT="$(cd "$_PATHS_SCRIPT_DIR/.." && pwd)"
else
  # Already at agent root
  export GENERAL_ROOT="$_PATHS_SCRIPT_DIR"
fi

export GENERAL_STATE_DIR="$GENERAL_ROOT/.general-v1"
export GENERAL_SAC_DIR="$GENERAL_STATE_DIR/sac"
export GENERAL_VECTORS_DIR="$GENERAL_STATE_DIR/vectors"
export GENERAL_MC_DIR="$GENERAL_STATE_DIR/mission-control"
export GENERAL_AUDIT_DIR="$GENERAL_STATE_DIR/audit"
export GENERAL_IDENTITY_FILE="$GENERAL_STATE_DIR/.identity"
export GENERAL_CONFIG_DIR="$GENERAL_ROOT/meta-agent/meta-agent-config"

# If .identity exists, expose it
if [[ -f "$GENERAL_IDENTITY_FILE" ]]; then
  export GENERAL_IDENTITY="$(cat "$GENERAL_IDENTITY_FILE")"
else
  export GENERAL_IDENTITY=""
fi

# Helper: resolve a path string from config (handles ~, ./, ../, absolute)
general_resolve_path() {
  local p="$1"
  if [[ -z "$p" ]]; then
    return 1
  fi
  if [[ "$p" == "~/"* ]]; then
    echo "$HOME/${p:2}"
  elif [[ "$p" == "~" ]]; then
    echo "$HOME"
  elif [[ "$p" == "./"* ]] || [[ "$p" == "../"* ]]; then
    echo "$GENERAL_ROOT/$p"
  else
    echo "$p"
  fi
}

export -f general_resolve_path
