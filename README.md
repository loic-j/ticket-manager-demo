# ticketmanager3

pnpm + Turborepo monorepo with a NestJS API and a Next.js web app sharing one typed API contract.

```
apps/
  api/        NestJS 12 (ESM, Vitest, oxlint)            → http://localhost:3001
  web/        Next.js 16 (App Router, Tailwind 4, ESLint) → http://localhost:3000
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

## Dependency versions

Versions shared by several packages (TypeScript, Zod, Vitest, `@types/node`, Prettier) are
pinned once in the `catalog:` section of `pnpm-workspace.yaml` and referenced as `"catalog:"`
in each `package.json`. Bump them there.

TypeScript is pinned to 6.x: NestJS 12 requires TS ≥ 6 and its CLI does not yet support the
TypeScript 7 (Go) compiler.
