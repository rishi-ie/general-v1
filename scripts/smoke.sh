#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."

echo "=== general v1 smoke test ==="

cd "$ROOT_DIR"

# 1. Check mode: config validation
echo "[1/4] Running --check (config validation)..."
if ./meta-agent/run.sh --check 2>&1; then
    echo "  PASS: config validation"
else
    echo "  FAIL: config validation exited non-zero"
    exit 1
fi

# 2. Offline boot: /exit makes it exit quickly, no timeout needed
echo "[2/4] Running --offline boot (banner + /exit)..."
OUTPUT=$(echo "/exit" | ./meta-agent/run.sh --offline 2>&1 | head -30 || true)
if echo "$OUTPUT" | grep -q "general v1"; then
    echo "  PASS: offline boot + banner"
else
    echo "  FAIL: offline boot"
    echo "  Output: $OUTPUT"
    exit 1
fi

# 3. Verify all extension files exist (-e checks dirs OR files)
echo "[3/4] Checking extension files exist..."
MISSING=0
CONFIG_FILE="$ROOT_DIR/meta-agent/meta-agent-config/config.json"
if command -v jq >/dev/null 2>&1; then
    while IFS= read -r ext; do
        [[ -z "$ext" ]] && continue
        EXT_PATH="$ROOT_DIR/meta-agent/meta-agent-config/$ext"
        if [[ ! -e "$EXT_PATH" ]]; then
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
