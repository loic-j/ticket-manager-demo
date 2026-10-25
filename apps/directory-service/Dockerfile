# syntax=docker/dockerfile:1
# Build from the repo root:  docker build -f apps/directory-service/Dockerfile .
# Single target (runner): no database, no broker, no migrations. HTTP only.

FROM node:26-alpine AS base
ENV TURBO_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 CI=1
RUN npm install -g pnpm@12.14.0
WORKDIR /repo

# Build tooling only (not shipped in the runner).
FROM base AS tooling
RUN npm install -g turbo@2.11.10

# 1. Keep only the files the directory package needs (and its workspace dependencies).
FROM tooling AS pruner
COPY . .
RUN turbo prune @ticketmanager/directory-service --docker

# 2. Install (cached while the lockfile is unchanged) and build.
FROM tooling AS builder
COPY --from=pruner /repo/out/json/ .
COPY --from=pruner /repo/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
RUN pnpm turbo run build --filter=@ticketmanager/directory-service

# 3. Production image: production dependencies of this package only + compiled output.
FROM base AS runner
ENV NODE_ENV=production
COPY --from=pruner /repo/out/json/ .
COPY --from=pruner /repo/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile --prod
COPY --from=builder /repo/packages/contracts/dist ./packages/contracts/dist
COPY --from=builder /repo/packages/nest-common/dist ./packages/nest-common/dist
COPY --from=builder /repo/apps/directory-service/dist ./apps/directory-service/dist
USER node
EXPOSE 3003
CMD ["node", "apps/directory-service/dist/main.js"]
