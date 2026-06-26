#!/bin/bash
# test-portable.sh — Verify the agent folder is portable across locations
#
# Builds a package, extracts to multiple locations, and verifies:
#   1. The package builds from source
#   2. ./agent.sh --check passes in the package
#   3. Smoke tests pass (4/4)
#   4. Identity is generated on first run
#   5. Copying the folder preserves identity
#   6. Moving the folder preserves identity
#   7. Two separate folders get distinct identities

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PKG_NAME="portable-test-agent"
WORK_ROOT="/tmp/portable-test-$$"
OUTPUT_DIR="$WORK_ROOT/$PKG_NAME"
COPY_DIR="$WORK_ROOT/${PKG_NAME}-copy"
MOVE_DIR="$WORK_ROOT/${PKG_NAME}-moved"
FRESH_DIR="$WORK_ROOT/${PKG_NAME}-fresh"

echo "=== general v1 portable test ==="
echo "Work dir: $WORK_ROOT"
echo ""

cleanup() {
  rm -rf "$WORK_ROOT"
}
trap cleanup EXIT

mkdir -p "$WORK_ROOT"

# ── Step 1: Build package ────────────────────────────────────────────────────
echo "[1/7] Building portable package from source..."
"$REPO_ROOT/meta-agent/package.sh" "$PKG_NAME" "$OUTPUT_DIR" 2>&1 | tail -5
[[ -f "$OUTPUT_DIR/agent.sh" ]] || { echo "FAIL: agent.sh not in package"; exit 1; }
[[ -x "$OUTPUT_DIR/agent.sh" ]] || { echo "FAIL: agent.sh not executable"; exit 1; }
[[ -f "$OUTPUT_DIR/.general-v1/.identity" ]] && echo "  WARN: identity file present (should NOT be)" && rm -f "$OUTPUT_DIR/.general-v1/.identity"
echo "  PASS"
echo ""

# ── Step 2: --check passes ───────────────────────────────────────────────────
echo "[2/7] Running --check on packaged agent..."
cd "$OUTPUT_DIR"
OUTPUT_CHECK=$(./agent.sh --check 2>&1)
echo "$OUTPUT_CHECK" | grep -q "OK" || { echo "FAIL: --check did not pass"; echo "$OUTPUT_CHECK"; exit 1; }
echo "  PASS"
echo ""

# ── Step 3: Smoke test ───────────────────────────────────────────────────────
echo "[3/7] Running smoke tests..."
OUTPUT_SMOKE=$(cd "$OUTPUT_DIR" && bash ./scripts/smoke.sh 2>&1)
echo "$OUTPUT_SMOKE" | grep -q "all smoke tests passed" || { echo "FAIL: smoke test failed"; echo "$OUTPUT_SMOKE"; exit 1; }
echo "  PASS"
echo ""

# ── Step 4: Identity generated on first run ──────────────────────────────────
echo "[4/7] Verifying identity generation..."
# Clear identity, run again, check it's created
rm -f "$OUTPUT_DIR/.general-v1/.identity"
(cd "$OUTPUT_DIR" && ./agent.sh --check >/dev/null 2>&1) &
AGENT_PID=$!
sleep 5
kill $AGENT_PID 2>/dev/null || true
wait $AGENT_PID 2>/dev/null || true
[[ -f "$OUTPUT_DIR/.general-v1/.identity" ]] || { echo "FAIL: identity not generated"; exit 1; }
IDENTITY_1="$(cat "$OUTPUT_DIR/.general-v1/.identity")"
[[ -n "$IDENTITY_1" ]] || { echo "FAIL: identity empty"; exit 1; }
echo "  Identity: $IDENTITY_1"
echo "  PASS"
echo ""

# ── Step 5: Copy preserves identity ──────────────────────────────────────────
echo "[5/7] Copying folder preserves identity..."
rm -rf "$COPY_DIR"
cp -R "$OUTPUT_DIR" "$COPY_DIR"
IDENTITY_COPY="$(cat "$COPY_DIR/.general-v1/.identity")"
[[ "$IDENTITY_COPY" == "$IDENTITY_1" ]] || { echo "FAIL: identity changed after copy: $IDENTITY_COPY"; exit 1; }
echo "  Identity: $IDENTITY_COPY (matches)"
echo "  PASS"
echo ""

# ── Step 6: Move preserves identity ──────────────────────────────────────────
echo "[6/7] Moving folder to new location preserves identity..."
mkdir -p "$(dirname "$MOVE_DIR")"
mv "$COPY_DIR" "$MOVE_DIR"
IDENTITY_MOVED="$(cat "$MOVE_DIR/.general-v1/.identity")"
[[ "$IDENTITY_MOVED" == "$IDENTITY_1" ]] || { echo "FAIL: identity changed after move: $IDENTITY_MOVED"; exit 1; }
# Verify --check still works in new location
OUTPUT_MOVED_CHECK=$(cd "$MOVE_DIR" && ./agent.sh --check 2>&1)
echo "$OUTPUT_MOVED_CHECK" | grep -q "OK" || { echo "FAIL: --check failed in moved location"; exit 1; }
echo "  Identity: $IDENTITY_MOVED (matches)"
echo "  PASS"
echo ""

# ── Step 7: Fresh copy gets distinct identity ────────────────────────────────
echo "[7/7] Fresh copy gets a NEW identity..."
rm -rf "$FRESH_DIR"
cp -R "$OUTPUT_DIR" "$FRESH_DIR"
rm -f "$FRESH_DIR/.general-v1/.identity"
(cd "$FRESH_DIR" && ./agent.sh --check >/dev/null 2>&1) &
AGENT_PID=$!
sleep 5
kill $AGENT_PID 2>/dev/null || true
wait $AGENT_PID 2>/dev/null || true
[[ -f "$FRESH_DIR/.general-v1/.identity" ]] || { echo "FAIL: fresh identity not generated"; exit 1; }
IDENTITY_FRESH="$(cat "$FRESH_DIR/.general-v1/.identity")"
[[ "$IDENTITY_FRESH" != "$IDENTITY_1" ]] || { echo "FAIL: fresh copy got same identity"; exit 1; }
echo "  Original: $IDENTITY_1"
echo "  Fresh:    $IDENTITY_FRESH"
echo "  PASS"
echo ""

echo "=== all portable tests passed ==="
