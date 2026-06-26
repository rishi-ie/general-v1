#!/bin/bash
# package.sh — Build a self-contained portable agent folder + tarball
#
# Usage:
#   ./meta-agent/package.sh [name] [output_dir]
#
# Defaults:
#   name        = general-v1-portable
#   output_dir  = /tmp/general-v1-portable
#
# Produces:
#   dist/general-v1-portable.tar.gz  — a fully self-contained agent folder
#
# The tarball can be extracted anywhere; the resulting folder:
#   - Boots via ./agent.sh
#   - Has no dependencies on the build machine
#   - Generates a unique ULID identity on first run
#   - Stores all state inside .general-v1/ (per-folder identity)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PKG_NAME="${1:-general-v1-portable}"
OUTPUT_DIR="${2:-/tmp/$PKG_NAME}"
TARBALL="$REPO_ROOT/dist/$PKG_NAME.tar.gz"

echo "[package] Source:    $REPO_ROOT"
echo "[package] Output:    $OUTPUT_DIR"
echo "[package] Tarball:   $TARBALL"
echo ""

echo "[package] Cleaning output dir..."
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

echo "[package] Copying source files (excluding .git, dist, caches)..."
rsync -a \
  --exclude='.git' \
  --exclude='dist' \
  --exclude='node_modules' \
  --exclude='.pi' \
  --exclude='.mission-control' \
  --exclude='.general-v1' \
  --exclude='meta-agent/pi/node_modules' \
  --exclude='meta-agent/.pi' \
  --exclude='*.log' \
  --exclude='.DS_Store' \
  "$REPO_ROOT/" "$OUTPUT_DIR/"

echo "[package] Bundling node_modules..."
if [ -d "$REPO_ROOT/node_modules" ]; then
  cp -R "$REPO_ROOT/node_modules" "$OUTPUT_DIR/"
else
  echo "[package] WARNING: no node_modules at $REPO_ROOT/node_modules"
fi

echo "[package] Copying Pi agent + its deps..."
if [ -d "$REPO_ROOT/meta-agent/pi" ]; then
  cp -R "$REPO_ROOT/meta-agent/pi" "$OUTPUT_DIR/meta-agent/"
  if [ -d "$REPO_ROOT/meta-agent/pi/node_modules" ]; then
    cp -R "$REPO_ROOT/meta-agent/pi/node_modules" "$OUTPUT_DIR/meta-agent/pi/"
  fi
else
  echo "[package] WARNING: no Pi agent at $REPO_ROOT/meta-agent/pi"
fi

echo "[package] Resolving symlinks (real files in package)..."
cd "$OUTPUT_DIR"
find . -type l | while read -r link; do
  target="$(readlink "$link")"
  if [[ -e "$target" ]]; then
    rm "$link"
    cp -R "$target" "$link"
    echo "  resolved: $link"
  else
    echo "  WARN broken: $link -> $target"
  fi
done

echo "[package] Making scripts executable..."
chmod +x "$OUTPUT_DIR/agent.sh" 2>/dev/null || true
chmod +x "$OUTPUT_DIR/meta-agent/run.sh" 2>/dev/null || true
chmod +x "$OUTPUT_DIR/meta-agent/setup.sh" 2>/dev/null || true
chmod +x "$OUTPUT_DIR/meta-agent/paths.sh" 2>/dev/null || true
chmod +x "$OUTPUT_DIR/scripts/smoke.sh" 2>/dev/null || true

echo "[package] Creating tarball..."
mkdir -p "$(dirname "$TARBALL")"
tar -czf "$TARBALL" -C "$(dirname "$OUTPUT_DIR")" "$(basename "$OUTPUT_DIR")"

echo ""
echo "[package] Done."
echo "[package] Tarball: $TARBALL"
echo "[package] Size:    $(du -h "$TARBALL" | cut -f1)"
echo "[package] Unpacked: $(du -sh "$OUTPUT_DIR" | cut -f1)"
echo ""
echo "To deploy:"
echo "  tar -xzf $TARBALL -C /anywhere/you/want"
echo "  cd $(basename "$OUTPUT_DIR")"
echo "  ./agent.sh -p 'hello'"
