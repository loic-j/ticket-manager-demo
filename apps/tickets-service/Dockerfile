# syntax=docker/dockerfile:1
# Build from the repo root:  docker build -f apps/tickets-service/Dockerfile .
# Targets: runner (the HTTP API), migrate (`prisma migrate deploy`). Compose builds them with
# `target:`. The outbox relay is a separate package and image: apps/tickets-relay-service.

FROM node:26-alpine AS base
ENV TURBO_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 CI=1
RUN npm install -g pnpm@12.14.0
WORKDIR /repo

# Build tooling only (not shipped in the runner).
FROM base AS tooling
RUN npm install -g turbo@2.11.10

# 1. Keep only the files the api package needs (and its workspace dependencies).
FROM tooling AS pruner
COPY . .
RUN turbo prune @ticketmanager/tickets-service --docker

# 2. Install (cached while the lockfile is unchanged), generate the Prisma client, build.
FROM tooling AS builder
COPY --from=pruner /repo/out/json/ .
COPY --from=pruner /repo/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
RUN pnpm turbo run build --filter=@ticketmanager/tickets-service

# 3a. Migration runner: same toolchain as the builder, runs the committed migrations.
#     Runs unprivileged: the files are root-owned but readable, and `migrate deploy` writes
#     nothing locally (the schema engine ships in node_modules, the state lives in the database).
FROM builder AS migrate
WORKDIR /repo/apps/tickets-service
USER node
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
COPY --from=builder /repo/packages/telemetry/dist ./packages/telemetry/dist
COPY --from=builder /repo/apps/tickets-service/dist ./apps/tickets-service/dist
USER node
EXPOSE 3001
WORKDIR /repo/apps/tickets-service
# The telemetry preload (OpenTelemetry SDK + pino) must load before the application code.
CMD ["node", "--import", "@ticketmanager/telemetry/register", "dist/main.js"]
