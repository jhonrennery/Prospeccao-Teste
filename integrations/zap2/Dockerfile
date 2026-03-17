FROM node:22-bookworm-slim AS base

ENV NODE_ENV=production
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps

COPY package.json package-lock.json ./
RUN npm ci && npm cache clean --force

FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json next.config.mjs ./
COPY src ./src
RUN npm run build

FROM base AS runner

ENV HOSTNAME=0.0.0.0

# /app/data será o volume persistente; .auth e storage são symlinks para ele
RUN mkdir -p /app/data \
  && ln -s /app/data/.auth /app/.auth \
  && ln -s /app/data/storage /app/storage

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/src/app/icon.svg ./src/app/icon.svg
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
  && chown -R node:node /app

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/zap2/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["/usr/local/bin/docker-entrypoint.sh"]
