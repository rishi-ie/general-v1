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
ln -sf "$SCRIPT_DIR/../v1/mem0"          "$CONFIG_DIR/v1/mem0"
ln -sf "$SCRIPT_DIR/../v1/mission-control" "$CONFIG_DIR/v1/mission-control"
ln -sf "$SCRIPT_DIR/../v1/permission"    "$CONFIG_DIR/v1/permission"
ln -sf "$SCRIPT_DIR/../v1/planning"      "$CONFIG_DIR/v1/planning"
ln -sf "$SCRIPT_DIR/../v1/sub-agent"     "$CONFIG_DIR/v1/sub-agent"
ln -sf "$SCRIPT_DIR/../v1/sub-agent-context" "$CONFIG_DIR/v1/sub-agent-context"
ln -sf "$SCRIPT_DIR/../v1/superhive"    "$CONFIG_DIR/v1/superhive"

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
./pi/pi-test.sh install npm:@mem0/pi-agent-plugin -l 2>&1 | tail -3 || echo "  (mem0 install may have issues, will retry)"
./pi/pi-test.sh install npm:pi-permission-system -l 2>&1 | tail -3 || echo "  (permission install may have issues, will retry)"

echo "[setup] Creating symlinks for npm packages in extensions/..."
mkdir -p "$CONFIG_DIR/extensions"

MEM0_PATH="$LOCAL_PI_DIR/npm/node_modules/@mem0/pi-agent-plugin"
PERM_PATH="$LOCAL_PI_DIR/npm/node_modules/pi-permission-system"

if [ -d "$MEM0_PATH" ]; then
    ln -sf "$MEM0_PATH/src/entry.ts" "$CONFIG_DIR/extensions/mem0-extension.ts"
    ln -sf "$MEM0_PATH/skills" "$CONFIG_DIR/extensions/mem0-skills"
    echo "  mem0 symlinks created"
else
    echo "  mem0 not installed yet (expected on first run)"
fi

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
