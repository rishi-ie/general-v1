FROM node:22-alpine

RUN apk add --no-cache \
    bash \
    su-exec \
    tini \
    openssh-client \
    python3 \
    py3-pip \
    jq \
    curl \
    wget \
    git \
    supervisor \
    && rm -rf /var/cache/apk/*

WORKDIR /app

COPY . /app

RUN mkdir -p /var/log/supervisord /var/run/supervisord

# Install Pi Agent dependencies
# First regenerate package-lock for the container's Node version, then install
RUN cd /app/meta-agent/pi && npm install --ignore-scripts --ignore-engines --package-lock-only && npm install --ignore-scripts --ignore-engines

# Install v1 module dependencies for extensions that need them
RUN cd /app/v1/superhive && npm install --ignore-scripts --ignore-engines || true
RUN cd /app/v1/communication && npm install --ignore-scripts --ignore-engines || true
RUN cd /app/v1/mission-control && npm install --ignore-scripts --ignore-engines || true
RUN cd /app/v1/sub-agent && npm install --ignore-scripts --ignore-engines || true
RUN cd /app/v1/sub-agent-context && npm install --ignore-scripts --ignore-engines || true

# Install runtime deps needed by integrations (ulid, ws, mem0ai, ajv)
RUN npm install --prefix /app ulid ws mem0ai ajv --ignore-scripts --ignore-engines

EXPOSE 7711

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=15s \
    CMD wget -qO- http://localhost:7711/health || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]
