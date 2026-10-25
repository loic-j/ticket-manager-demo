# syntax=docker/dockerfile:1
# Build from the repo root:  docker build -f apps/tickets-relay-service/Dockerfile .
# Single target (runner): the relay has no HTTP server, no ORM and no migrations of its own.

FROM node:26-alpine AS base
ENV TURBO_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 CI=1
RUN npm install -g pnpm@12.14.0
WORKDIR /repo

# Build tooling only (not shipped in the runner).
FROM base AS tooling
RUN npm install -g turbo@2.11.10

# 1. Keep only the files the relay package needs (and its workspace dependencies).
FROM tooling AS pruner
COPY . .
RUN turbo prune @ticketmanager/tickets-relay-service --docker

# 2. Install (cached while the lockfile is unchanged) and build.
FROM tooling AS builder
COPY --from=pruner /repo/out/json/ .
COPY --from=pruner /repo/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
RUN pnpm turbo run build --filter=@ticketmanager/tickets-relay-service

# 3. Production image: production dependencies of this package only + compiled output.
FROM base AS runner
ENV NODE_ENV=production
COPY --from=pruner /repo/out/json/ .
COPY --from=pruner /repo/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile --prod
COPY --from=builder /repo/packages/contracts/dist ./packages/contracts/dist
COPY --from=builder /repo/packages/events/dist ./packages/events/dist
COPY --from=builder /repo/packages/outbox/dist ./packages/outbox/dist
COPY --from=builder /repo/apps/tickets-relay-service/dist ./apps/tickets-relay-service/dist
USER node
CMD ["node", "apps/tickets-relay-service/dist/main.js"]
