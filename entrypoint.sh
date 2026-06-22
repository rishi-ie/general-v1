#!/bin/bash
set -e

SUPERHIVE_API_KEY="${SUPERHIVE_API_KEY:-}"

if [ -n "$SUPERHIVE_API_KEY" ]; then
    echo "API key provided via SUPERHIVE_API_KEY env var"
elif [ -f /root/.superhive/api_key ]; then
    SUPERHIVE_API_KEY=$(cat /root/.superhive/api_key)
    echo "Using existing API key from /root/.superhive/api_key"
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

if [ -f /app/agents.json ]; then
    python3 -c "
import json, sys
agents = json.load(open('/app/agents.json'))
for i, agent in enumerate(agents):
    print(f'[{agent}]')
" 2>/dev/null || true
fi

cat > /app/supervisord.conf << 'SUPERVISOR_EOF'
[supervisord]
nodaemon=true
logfile=/var/log/supervisord/supervisord.log
pidfile=/var/run/supervisord/supervisord.pid
loglevel=info
user=root

[unix_http_server]
file=/var/run/supervisor.sock
chmod=0700

[supervisorctl]
serverurl=unix:///var/run/supervisor.sock

[rpcinterface:supervisor]
supervisor.rpcinterface_factory = supervisor.rpcinterface:make_main_rpcinterface
SUPERVISOR_EOF

AGENT_INDEX=0
for agent in $(jq -r '.[].name' /app/agents.json 2>/dev/null || echo "general"); do
    AGENT_CWD=$(jq -r ".[$AGENT_INDEX].cwd // \"/root\"" /app/agents.json 2>/dev/null || echo "/root")
    AGENT_META_CONFIG=$(jq -r ".[$AGENT_INDEX].config.metaAgentConfig // \"/app/meta-agent/meta-agent-config/config.json\"" /app/agents.json 2>/dev/null || echo "/app/meta-agent/meta-agent-config/config.json")
    AGENT_PI_DIR=$(jq -r ".[$AGENT_INDEX].config.piDir // \"/app/pi\"" /app/agents.json 2>/dev/null || echo "/app/pi")

    cat >> /app/supervisord.conf << SUPERVISOR_EOF

[program:pi-agent-${agent}]
command=/app/pi/pi run.sh --config %(env_AGENT_META_CONFIG)s --cwd %(env_AGENT_CWD)s
directory=$AGENT_CWD
autostart=true
autorestart=true
stdout_logfile=/var/log/supervisord/pi-${agent}-stdout.log
stderr_logfile=/var/log/supervisord/pi-${agent}-stderr.log
stdout_logfile_maxbytes=10MB
stderr_logfile_maxbytes=10MB
user=root
environment=HOME="$AGENT_CWD",SUPERHIVE_API_KEY="%(ENV_SUPERHIVE_API_KEY)s",AGENT_CWD="$AGENT_CWD",AGENT_META_CONFIG="$AGENT_META_CONFIG",AGENT_PI_DIR="$AGENT_PI_DIR",NODE_ENV="production"
priority=200
SUPERVISOR_EOF

    AGENT_INDEX=$((AGENT_INDEX + 1))
done

echo "Starting supervisord..."
exec /usr/bin/supervisord -c /app/supervisord.conf
