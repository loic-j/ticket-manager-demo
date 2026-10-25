# syntax=docker/dockerfile:1
# Build from the repo root:  docker build -f apps/web/Dockerfile .
# Uses Next.js standalone output; all configuration is read at runtime from the environment.

FROM node:26-alpine AS base
ENV TURBO_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 NEXT_TELEMETRY_DISABLED=1 CI=1
RUN npm install -g pnpm@12.14.0
WORKDIR /repo

# Build tooling only (not shipped in the runner).
FROM base AS tooling
RUN npm install -g turbo@2.11.10

# 1. Keep only the files the web package needs (and its workspace dependencies).
FROM tooling AS pruner
COPY . .
RUN turbo prune @ticketmanager/web --docker

# 2. Install (cached while the lockfile is unchanged) and build the standalone output.
FROM tooling AS builder
COPY --from=pruner /repo/out/json/ .
COPY --from=pruner /repo/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
RUN pnpm turbo run build --filter=@ticketmanager/web

# 3. Production image: the standalone server only, no package manager or build tool.
FROM node:26-alpine AS runner
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=builder /repo/apps/web/.next/standalone ./
COPY --from=builder /repo/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
