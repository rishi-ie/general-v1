#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="$SCRIPT_DIR/meta-agent-config"
PI_DIR="$SCRIPT_DIR/pi"
LOCAL_PI_DIR="$SCRIPT_DIR/.pi"

echo "[setup] Installing Pi Agent dependencies..."
if [ ! -d "$PI_DIR/node_modules" ]; then
    cd "$PI_DIR" && npm install --ignore-scripts
    cd "$SCRIPT_DIR"
fi

echo "[setup] Creating v1 symlinks in meta-agent-config..."
mkdir -p "$CONFIG_DIR/v1"
ln -sf "$SCRIPT_DIR/../v1/browser"       "$CONFIG_DIR/v1/browser"
ln -sf "$SCRIPT_DIR/../v1/communication" "$CONFIG_DIR/v1/communication"
ln -sf "$SCRIPT_DIR/../v1/docs"          "$CONFIG_DIR/v1/docs"
ln -sf "$SCRIPT_DIR/../v1/identity"      "$CONFIG_DIR/v1/identity"
ln -sf "$SCRIPT_DIR/../v1/mission-control" "$CONFIG_DIR/v1/mission-control"
ln -sf "$SCRIPT_DIR/../v1/permission"    "$CONFIG_DIR/v1/permission"
ln -sf "$SCRIPT_DIR/../v1/planning"      "$CONFIG_DIR/v1/planning"
ln -sf "$SCRIPT_DIR/../v1/sub-agent"     "$CONFIG_DIR/v1/sub-agent"
ln -sf "$SCRIPT_DIR/../v1/sub-agent-context" "$CONFIG_DIR/v1/sub-agent-context"
ln -sf "$SCRIPT_DIR/../v1/superhive"    "$CONFIG_DIR/v1/superhive"
ln -sf "$SCRIPT_DIR/../v1/integrations"   "$CONFIG_DIR/v1/integrations"
ln -sf "$SCRIPT_DIR/../v1/lancedb"         "$CONFIG_DIR/v1/lancedb"

echo "[setup] Adding pi field to v1 package.json files missing it..."
add_pi_field() {
    local pkg_json="$1"
    local pi_ext="$2"
    local pi_skill="$3"
    if [ -f "$pkg_json" ]; then
        if ! grep -q '"pi"' "$pkg_json"; then
            python3 -c "
import json, sys
with open('$pkg_json', 'r') as f:
    d = json.load(f)
d['pi'] = {'extensions': ['$pi_ext']${pi_skill:+, 'skills': ['$pi_skill']}}
with open('$pkg_json', 'w') as f:
    json.dump(d, f, indent=2)
"
            echo "  added pi field to $pkg_json"
        else
            echo "  $pkg_json already has pi field"
        fi
    fi
}

add_pi_field "$SCRIPT_DIR/../v1/mission-control/package.json" \
    "extensions/mission-control/index.ts" \
    "SKILL.md"

echo "[setup] Installing npm packages (project scope, goes to .pi/npm/)..."
cd "$SCRIPT_DIR"
./pi/pi-test.sh install npm:pi-permission-system -l 2>&1 | tail -3 || echo "  (permission install may have issues, will retry)"

echo "[setup] Creating symlinks for npm packages in extensions/..."
mkdir -p "$CONFIG_DIR/extensions"

PERM_PATH="$LOCAL_PI_DIR/npm/node_modules/pi-permission-system"

if [ -d "$PERM_PATH" ]; then
    ln -sf "$PERM_PATH/index.ts" "$CONFIG_DIR/extensions/permission-extension.ts"
    echo "  permission symlinks created"
else
    echo "  permission not installed yet (expected on first run)"
fi

echo "[setup] Creating local .pi directory..."
mkdir -p "$LOCAL_PI_DIR/agent/sessions"
mkdir -p "$LOCAL_PI_DIR/agent/bin"
mkdir -p "$LOCAL_PI_DIR/agent/prompts"

echo "[setup] Done."
