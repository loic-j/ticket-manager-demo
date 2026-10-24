# syntax=docker/dockerfile:1
# Build from the repo root:  docker build -f apps/tickets-service/Dockerfile .
# Targets: runner (the HTTP API), relay (the outbox relay process), migrate (`prisma migrate deploy`).
# Each target is a separate image; compose builds them with `target:`.

FROM node:26-alpine AS base
ENV TURBO_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 CI=1
RUN npm install -g pnpm@12.14.0 turbo@2.11.10
WORKDIR /repo

# 1. Keep only the files the api package needs (and its workspace dependencies).
FROM base AS pruner
COPY . .
RUN turbo prune @ticketmanager/tickets-service --docker

# 2. Install (cached while the lockfile is unchanged), generate the Prisma client, build.
FROM base AS builder
COPY --from=pruner /repo/out/json/ .
COPY --from=pruner /repo/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
RUN pnpm turbo run build --filter=@ticketmanager/tickets-service

# 3a. Migration runner: same toolchain as the builder, runs the committed migrations.
FROM builder AS migrate
WORKDIR /repo/apps/tickets-service
CMD ["pnpm", "prisma", "migrate", "deploy"]

# 3b. Production image of the HTTP API: production dependencies + compiled output only.
FROM base AS runner
ENV NODE_ENV=production
COPY --from=pruner /repo/out/json/ .
COPY --from=pruner /repo/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile --prod
COPY --from=builder /repo/packages/contracts/dist ./packages/contracts/dist
COPY --from=builder /repo/packages/nest-common/dist ./packages/nest-common/dist
COPY --from=builder /repo/packages/events/dist ./packages/events/dist
COPY --from=builder /repo/apps/tickets-service/dist ./apps/tickets-service/dist
USER node
EXPOSE 3001
CMD ["node", "apps/tickets-service/dist/main.js"]

# 3c. Outbox relay: same code and dependencies, headless entry point, no port.
FROM runner AS relay
CMD ["node", "apps/tickets-service/dist/main.relay.js"]
