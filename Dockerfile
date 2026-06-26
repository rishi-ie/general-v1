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
    && rm -rf /var/cache/apk/*

RUN pip install --no-cache-dir supervisord

WORKDIR /app

COPY . /app

RUN mkdir -p /var/log/supervisord /var/run/supervisord

# Install Pi Agent dependencies
RUN cd /app/meta-agent/pi && npm ci --ignore-scripts

# Install v1 module dependencies for extensions that need them
RUN cd /app/v1/superhive && npm ci --ignore-scripts || true
RUN cd /app/v1/communication && npm ci --ignore-scripts || true
RUN cd /app/v1/mission-control && npm ci --ignore-scripts || true
RUN cd /app/v1/sub-agent && npm ci --ignore-scripts || true
RUN cd /app/v1/sub-agent-context && npm ci --ignore-scripts || true

EXPOSE 7711

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=15s \
    CMD wget -qO- http://localhost:7711/health || exit 1

ENTRYPOINT ["/entrypoint.sh"]
