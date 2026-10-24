# syntax=docker/dockerfile:1
# Build from the repo root:  docker build -f apps/api/Dockerfile .
# Targets: runner (default, the API), migrate (runs `prisma migrate deploy`).

FROM node:26-alpine AS base
ENV TURBO_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 CI=1
RUN npm install -g pnpm@12.14.0 turbo@2.11.10
WORKDIR /repo

# 1. Keep only the files the api package needs (and its workspace dependencies).
FROM base AS pruner
COPY . .
RUN turbo prune @ticketmanager/api --docker

# 2. Install (cached while the lockfile is unchanged), generate the Prisma client, build.
FROM base AS builder
COPY --from=pruner /repo/out/json/ .
COPY --from=pruner /repo/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
RUN pnpm turbo run build --filter=@ticketmanager/api

# 3a. Migration runner: same toolchain as the builder, runs the committed migrations.
FROM builder AS migrate
WORKDIR /repo/apps/api
CMD ["pnpm", "prisma", "migrate", "deploy"]

# 3b. Production image: production dependencies + compiled output only.
FROM base AS runner
ENV NODE_ENV=production
COPY --from=pruner /repo/out/json/ .
COPY --from=pruner /repo/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile --prod
COPY --from=builder /repo/packages/shared/dist ./packages/shared/dist
COPY --from=builder /repo/apps/api/dist ./apps/api/dist
USER node
EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]
