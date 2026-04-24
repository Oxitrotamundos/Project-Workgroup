# syntax=docker/dockerfile:1.6
#
# Build context MUST be the repo root so we can COPY workspace manifests.
# In Render: set "Dockerfile Path" = apps/api/Dockerfile, "Docker Build
# Context Directory" = . (root).

# ---------- Stage 1: Build ----------
FROM node:20-slim AS builder

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Workspace manifests first for Docker layer caching.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/

RUN npm ci

# Source
COPY apps/api apps/api
COPY packages/shared packages/shared

# Build: shared lib -> prisma client -> nest app
RUN npm run build:shared \
    && npm -w apps/api exec -- prisma generate \
    && npm -w apps/api run build

# ---------- Stage 2: Runtime ----------
FROM node:20-slim AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates tini \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

# Manifests + lockfile (runtime needs them for workspace resolution)
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/apps/api/package.json apps/api/
COPY --from=builder /app/packages/shared/package.json packages/shared/

# Full node_modules from builder (preserves workspace symlinks + prisma CLI)
COPY --from=builder /app/node_modules ./node_modules

# Built JS + Prisma schema + TS config (prisma.config.ts loaded by CLI via jiti)
COPY --from=builder /app/apps/api/dist apps/api/dist
COPY --from=builder /app/apps/api/prisma apps/api/prisma
COPY --from=builder /app/apps/api/prisma.config.ts apps/api/prisma.config.ts
COPY --from=builder /app/apps/api/tsconfig.json apps/api/tsconfig.json
COPY --from=builder /app/packages/shared/dist packages/shared/dist

EXPOSE 3000

# tini as PID 1 so SIGTERM/SIGINT propagate correctly to node.
ENTRYPOINT ["/usr/bin/tini", "--"]

# Apply pending migrations, then boot the Nest app.
CMD ["sh", "-c", "npm -w apps/api exec -- prisma migrate deploy && node apps/api/dist/main.js"]
