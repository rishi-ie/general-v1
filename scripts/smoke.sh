#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."

echo "=== general v1 smoke test ==="

# 1. Check mode: config validation
echo "[1/4] Running --check (config validation)..."
cd "$ROOT_DIR"
if ./meta-agent/run.sh --check 2>&1; then
    echo "  PASS: config validation"
else
    echo "  FAIL: config validation exited non-zero"
    exit 1
fi

# 2. Offline boot: should start, print banner, exit cleanly on /exit
echo "[2/4] Running --offline boot (banner + /exit)..."
echo "/exit" | timeout 30 ./meta-agent/run.sh --offline 2>&1 | head -30 | grep -q "general v1" && {
    echo "  PASS: offline boot + banner"
} || {
    echo "  FAIL: offline boot (check output above)"
    exit 1
}

# 3. Verify all extension files exist
echo "[3/4] Checking extension files exist..."
MISSING=0
CONFIG_FILE="$ROOT_DIR/meta-agent/meta-agent-config/config.json"
if command -v jq >/dev/null 2>&1; then
    while IFS= read -r ext; do
        [[ -z "$ext" ]] && continue
        EXT_PATH="$ROOT_DIR/meta-agent/meta-agent-config/$ext"
        if [[ ! -f "$EXT_PATH" ]]; then
            echo "  MISSING: $EXT_PATH"
            MISSING=$((MISSING + 1))
        fi
    done < <(jq -r '.extensions[]' "$CONFIG_FILE" 2>/dev/null)
fi

if [[ $MISSING -eq 0 ]]; then
    echo "  PASS: all extension files present"
else
    echo "  FAIL: $MISSING extension file(s) missing"
    exit 1
fi

# 4. Verify skill files exist
echo "[4/4] Checking skill files exist..."
MISSING_SKILLS=0
if command -v jq >/dev/null 2>&1; then
    while IFS= read -r skill; do
        [[ -z "$skill" ]] && continue
        SKILL_PATH="$ROOT_DIR/meta-agent/meta-agent-config/$skill"
        if [[ ! -f "$SKILL_PATH" ]]; then
            echo "  MISSING: $SKILL_PATH"
            MISSING_SKILLS=$((MISSING_SKILLS + 1))
        fi
    done < <(jq -r '.skills[]' "$CONFIG_FILE" 2>/dev/null)
fi

if [[ $MISSING_SKILLS -eq 0 ]]; then
    echo "  PASS: all skill files present"
else
    echo "  FAIL: $MISSING_SKILLS skill file(s) missing"
    exit 1
fi

echo ""
echo "=== all smoke tests passed ==="
