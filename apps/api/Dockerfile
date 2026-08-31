# ---------------------------------------------------------------------------
# CarBuddy API — multi-stage production image.
#
# Multi-stage so the runtime image carries only compiled output and production
# dependencies. Shipping the toolchain and the TypeScript source would triple
# the image size and hand an attacker the build tools if they got a shell.
# ---------------------------------------------------------------------------

FROM node:22-alpine AS base
# OpenSSL is required by Prisma's query engine on Alpine.
RUN apk add --no-cache openssl
WORKDIR /app

# ---- Dependencies ---------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
COPY packages/domain/package.json ./packages/domain/
COPY apps/api/package.json ./apps/api/
# `npm ci` installs exactly the lockfile, which is what makes a build
# reproducible; `npm install` may silently resolve different versions.
RUN npm ci --workspaces --include-workspace-root

# ---- Build ----------------------------------------------------------------
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/domain ./packages/domain
COPY apps/api ./apps/api
RUN npm run build -w @carbuddy/domain \
 && npm run prisma:generate -w @carbuddy/api \
 && npm run build -w @carbuddy/api

# ---- Runtime --------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production

# Run as a non-root user. The node image ships one; a container process running
# as root turns a container escape into a host compromise.
USER node

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/packages/domain/dist ./packages/domain/dist
COPY --from=build --chown=node:node /app/packages/domain/package.json ./packages/domain/
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=node:node /app/apps/api/prisma ./apps/api/prisma
COPY --from=build --chown=node:node /app/apps/api/package.json ./apps/api/

EXPOSE 4000

# Readiness is checked here rather than liveness: the orchestrator should stop
# routing traffic to an instance that cannot reach the database, but must not
# kill it — a brief database blip would otherwise cascade into a restart storm.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

WORKDIR /app/apps/api
CMD ["node", "dist/main.js"]
