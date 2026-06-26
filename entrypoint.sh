#!/bin/bash
set -e

SUPERHIVE_API_KEY="${SUPERHIVE_API_KEY:-}"

if [ -n "$SUPERHIVE_API_KEY" ]; then
    echo "[entrypoint] API key provided via SUPERHIVE_API_KEY env var"
elif [ -f /root/.superhive/api_key ]; then
    SUPERHIVE_API_KEY=$(cat /root/.superhive/api_key)
    echo "[entrypoint] Using existing API key from /root/.superhive/api_key"
else
    API_KEY=$(head -c 32 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 32)
    mkdir -p /root/.superhive
    echo "$API_KEY" > /root/.superhive/api_key
    chmod 600 /root/.superhive/api_key
    SUPERHIVE_API_KEY="$API_KEY"
    echo ""
    echo "=========================================="
    echo "  SUPERHIVE API KEY (first boot)"
    echo "=========================================="
    echo ""
    echo "  $API_KEY"
    echo ""
    echo "  This key is stored at ~/.superhive/api_key"
    echo "=========================================="
    echo ""
fi

# pi-test.sh needs node_modules — installed at build time via COPY . /app
if [ ! -d /app/meta-agent/pi/node_modules ]; then
    echo "[entrypoint] WARNING: pi node_modules not found at /app/meta-agent/pi/node_modules"
fi

echo "[entrypoint] Starting supervisord..."
exec /usr/bin/supervisord -c /app/supervisord.conf
