# syntax=docker/dockerfile:1.6
#
# Build context MUST be the repo root so we can COPY workspace manifests.
# In Render: set "Dockerfile Path" = ./apps/api/Dockerfile, "Docker Build
# Context Directory" = . (root).

# ---------- Stage 1: Build ----------
FROM node:22-slim AS builder

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Enable corepack and pin pnpm so the lockfile is honored exactly.
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app

# Workspace manifests + lockfile first for layer caching.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/mcp/package.json packages/mcp/

# Use a mount cache for the pnpm store so repeated builds are fast.
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Source
COPY apps/api apps/api
COPY packages/shared packages/shared
COPY packages/mcp packages/mcp

# Build: shared lib -> mcp lib -> prisma client -> nest app
RUN pnpm --filter @project-workgroup/shared run build \
    && pnpm --filter @project-workgroup/mcp run build \
    && pnpm --filter @project-workgroup/api exec prisma generate \
    && pnpm --filter @project-workgroup/api run build

# ---------- Stage 2: Runtime ----------
FROM node:22-slim AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates tini \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app
ENV NODE_ENV=production

# Manifests + lockfile (runtime needs them for workspace resolution)
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/apps/api/package.json apps/api/
COPY --from=builder /app/packages/shared/package.json packages/shared/
COPY --from=builder /app/packages/mcp/package.json packages/mcp/

# Full node_modules from builder (preserves workspace symlinks + prisma CLI)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules apps/api/node_modules
COPY --from=builder /app/packages/shared/node_modules packages/shared/node_modules
COPY --from=builder /app/packages/mcp/node_modules packages/mcp/node_modules

# Built JS + Prisma schema + TS config (prisma.config.ts loaded by CLI via jiti)
COPY --from=builder /app/apps/api/dist apps/api/dist
COPY --from=builder /app/apps/api/prisma apps/api/prisma
COPY --from=builder /app/apps/api/prisma.config.ts apps/api/prisma.config.ts
COPY --from=builder /app/apps/api/tsconfig.json apps/api/tsconfig.json
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/packages/mcp/dist packages/mcp/dist

EXPOSE 3000

# tini as PID 1 so SIGTERM/SIGINT propagate correctly to node.
ENTRYPOINT ["/usr/bin/tini", "--"]

# Apply pending migrations, then boot the Nest app.
CMD ["sh", "-c", "pnpm --filter @project-workgroup/api exec prisma migrate deploy && node apps/api/dist/main.js"]
