---
name: add-domain-module
description: Scaffold a new bounded context in apps/api following the project's clean-architecture layout (domain port + errors, application service, in-memory and Prisma adapters, presentation controller + error filter, module binding, shared Zod schemas, unit and e2e tests). Use when adding a new resource/aggregate to the API.
argument-hint: <context-name> (singular noun, e.g. comment)
---

Scaffold the bounded context `$ARGUMENTS` by mirroring `apps/api/src/tickets/` exactly. Read that
folder first; do not invent a different structure.

1. **Contract** in `packages/shared/src/<plural>/`: `<name>.schema.ts` with the entity schema,
   `create<Name>Schema`, `update<Name>Schema`, id schema, inferred types, `index.ts`, a `*.test.ts`;
   re-export from `packages/shared/src/index.ts`; build the package.
2. **Domain** `apps/api/src/<plural>/domain/`: `<name>.ts` (type + pure factory/update functions),
   `<name>.repository.ts` (interface + `const <NAME>_REPOSITORY = Symbol(...)` token),
   `<name>-not-found.error.ts`.
3. **Application** `application/<plural>.service.ts`: use cases injecting the port by token; throws
   domain errors only.
4. **Infrastructure**: `in-memory-<name>.repository.ts` (used by tests) and, if persisted,
   `prisma-<name>.repository.ts` + Prisma model/enums in `prisma/schema.prisma` (then run the
   `db-migration` skill).
5. **Presentation**: `<plural>.controller.ts` using `@Body({ schema })` / `@Param('id', { schema })`
   with the shared schemas, and `<name>-errors.filter.ts` mapping domain errors to HTTP.
6. **Module** `<plural>.module.ts`: bind the token to the chosen adapter; import it in
   `app.module.ts`.
7. **Tests**: `application/<plural>.service.spec.ts` (in-memory), `test/<plural>.e2e-spec.ts`
   (use `TestAuth.createApp()` and override the new token with the in-memory adapter).
8. **Web** (only if asked): `ticketsApi`-style client in `apps/web/src/lib/api.ts`, server actions,
   components.
9. Run the `verify` skill and report the files created.
