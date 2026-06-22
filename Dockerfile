FROM node:20-alpine

RUN apk add --no-cache \
    bash \
    su-exec \
    tini \
    openssh-client \
    python3 \
    jq \
    && rm -rf /var/cache/apk/*

WORKDIR /app

RUN mkdir -p /var/log/supervisord /var/run/supervisord

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 7711

ENTRYPOINT ["/entrypoint.sh"]
