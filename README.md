# ticketmanager3

pnpm + Turborepo monorepo with a NestJS API and a Next.js web app sharing one typed API contract.

```
apps/
  api/        NestJS 12 (ESM, Vitest, oxlint), clean architecture → http://localhost:3001
  web/        Next.js 16 (App Router, Tailwind 4, ESLint) → http://localhost:3000
infra/
  logto/      docker-compose Logto + PostgreSQL (auth)
packages/
  shared/             @ticketmanager/shared — Zod schemas + inferred types (the API contract)
  typescript-config/  @ticketmanager/typescript-config — shared tsconfig presets
```

## Requirements

- Node.js ≥ 22.12 (see `.node-version`)
- pnpm 12 (`corepack enable` or `npm i -g pnpm`)

## Commands

All commands run from the repo root and go through Turborepo, which builds dependencies first
and caches results.

| Command            | What it does                                            |
| ------------------ | ------------------------------------------------------- |
| `pnpm install`     | Install everything                                      |
| `pnpm dev`         | Build `shared`, then run API, web and `shared` in watch |
| `pnpm build`       | Build all packages                                      |
| `pnpm check-types` | `tsc --noEmit` in every package                         |
| `pnpm lint`        | oxlint (api) + ESLint (web)                             |
| `pnpm test`        | Vitest unit tests (api, shared)                         |
| `pnpm test:e2e`    | API e2e tests (supertest)                               |
| `pnpm format`      | Prettier on the whole repo                              |

Target a single package with a filter, e.g. `pnpm turbo run dev --filter=@ticketmanager/api`,
or run its own scripts with `pnpm --filter @ticketmanager/web dev`.

Copy `apps/api/.env.example` and `apps/web/.env.example` to `.env` to override ports / URLs.

## How type sharing works

1. Schemas live in `packages/shared/src` and are written with Zod. Types are inferred from them
   (`z.infer`, `z.input`, `z.output`), so there is exactly one definition per payload.
2. The API validates requests with the same schemas through NestJS 12's Standard Schema support:
   `@Body({ schema: createTicketSchema })`. A global `StandardSchemaValidationPipe` is registered
   in `apps/api/src/main.ts`. No class-based DTOs or `class-validator` needed.
3. The web app imports the inferred types (and may reuse the schemas client-side for forms).
4. `@ticketmanager/shared` is a _compiled_ internal package: `tsc` emits `dist/` with `.js`,
   `.d.ts` and declaration maps. Both apps consume the compiled output, so it works with the
   NestJS `tsc` build, with Node at runtime, with Vitest and with Turbopack alike. Turborepo's
   `dependsOn: ["^build"]` guarantees it is built before any dependent task, and `pnpm dev`
   keeps it rebuilding with `tsc --watch`.

Adding a new domain: create `packages/shared/src/<domain>/<name>.schema.ts`, re-export it from
`packages/shared/src/index.ts`, then import from `@ticketmanager/shared` in both apps.

## Authentication (Logto)

Authentication is delegated to [Logto](https://logto.io) (open source, self-hosted), running in
Docker with **its own PostgreSQL**, separate from the future tickets database.

```
Browser ──► Next.js (:3000) ──OIDC──► Logto (:3301, console :3302)
               │  encrypted session cookie (@logto/next)
               └──► NestJS API (:3001) with `Authorization: Bearer <access token>`
                         └── verifies the JWT (jose): JWKS signature, issuer, audience
```

The browser never calls the API directly: Next.js Server Components and Server Actions call it
server-side with an access token issued for the API resource `https://api.ticketmanager.local`
(constant `API_RESOURCE_INDICATOR` in `@ticketmanager/shared`). On the API side, a global guard
requires a valid token on every route except those marked `@Public()` (`apps/api/src/auth/`).
The e2e tests replace the verifier with a local key pair: they run without Logto or Docker.

### One-time setup

1. Start Logto: `pnpm logto:up` (Docker Desktop required). Wait until
   `curl localhost:3301/oidc/.well-known/openid-configuration` responds.
2. Open the console at `http://localhost:3302` and create the admin account (first launch).
3. **Applications → Create application → Traditional web → Next.js (App Router)**, name
   `ticketmanager-web`:
   - Redirect URI: `http://localhost:3000/callback`
   - Post sign-out redirect URI: `http://localhost:3000/`
   - Copy the _App ID_ and an _App secret_.
4. **API resources → Create API resource**: name `ticketmanager-api`, identifier
   `https://api.ticketmanager.local`. Without it Logto refuses to issue the API token
   (`invalid_target`).
5. **Users → Add user**: create a test user (or enable sign-up under _Sign-in experience_).
6. Create `apps/web/.env.local` from `apps/web/.env.example` with the App ID, the App secret and a
   `LOGTO_COOKIE_SECRET` of 32+ characters (`openssl rand -base64 32`).
7. `pnpm dev`, open `http://localhost:3000`, click _Sign in_.

Stop with `pnpm logto:down` (data persists in the Docker volume `logto-pg-data`).

Next steps: `tickets:read` / `tickets:write` permissions on the API resource plus Logto roles
(RBAC) with a `@RequireScopes()` decorator; a database-backed `TicketRepository`.

## API architecture

Each bounded context under `apps/api/src/` follows a light clean-architecture layout:

```
tickets/
  domain/           Ticket model, TicketRepository port, domain errors. No NestJS, no HTTP.
  application/      TicketsService: use cases, depends on the port only.
  infrastructure/   Adapters implementing the port (InMemoryTicketRepository today).
  presentation/     HTTP controller and the filter mapping domain errors to HTTP status codes.
  tickets.module.ts Composition root: binds TICKET_REPOSITORY to the chosen adapter.
```

Request validation happens at the boundary with the Zod schemas from `@ticketmanager/shared`, so
DTO types are shared with the web app. To persist tickets, add an adapter in `infrastructure/`
and change the binding in `tickets.module.ts`; nothing else moves.

## Dependency versions

Versions shared by several packages (TypeScript, Zod, Vitest, `@types/node`, Prettier) are
pinned once in the `catalog:` section of `pnpm-workspace.yaml` and referenced as `"catalog:"`
in each `package.json`. Bump them there.

TypeScript is pinned to 6.x: NestJS 12 requires TS ≥ 6 and its CLI does not yet support the
TypeScript 7 (Go) compiler.
