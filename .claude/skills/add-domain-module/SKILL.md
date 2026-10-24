---
name: add-domain-module
description: Scaffold a new bounded context in a NestJS service (apps/*-service) following the project's clean-architecture layout (domain port + errors, application service, in-memory and Prisma adapters, presentation controller + error filter, module binding, shared Zod schemas, unit and e2e tests). Use when adding a new resource/aggregate to the API.
argument-hint: <context-name> (singular noun, e.g. comment)
---

Scaffold the bounded context `$ARGUMENTS` (optionally prefixed by the service directory, default
`tickets-service`) by mirroring `apps/tickets-service/src/tickets/` exactly. Read that
folder first; do not invent a different structure.

1. **Contract** in `packages/contracts/src/<plural>/`: `<name>.schema.ts` with the entity schema,
   `create<Name>Schema`, `update<Name>Schema`, id schema, inferred types, `index.ts`, a `*.test.ts`;
   re-export from `packages/contracts/src/index.ts`; build the package.
2. **Domain** `apps/tickets-service/src/<plural>/domain/`: `<name>.ts` (type + pure transitions
   returning `{ <name>, events }`), `events/<name>-events.ts` (plain event classes),
   `<name>.repository.ts` (write port interface + `const <NAME>_REPOSITORY = Symbol(...)` token),
   `<name>-not-found.error.ts`.
3. **Application**: `commands/<verb>-<name>.command.ts` + `.handler.ts` (`@CommandHandler`, write
   port by token, publish events on `EventBus`, return id/void), `queries/<verb>-<name>.query.ts` +
   `.handler.ts` (`@QueryHandler`, read port), `ports/<name>-read.repository.ts` (read port +
   token), `commands/index.ts` and `queries/index.ts` exporting the handler arrays.
4. **Infrastructure**: `in-memory-<name>.repository.ts` implementing both ports (tests) and, if
   persisted, `prisma-<name>.repository.ts` (write) + `prisma-<name>-read.repository.ts` (read) +
   Prisma model/enums in `prisma/schema.prisma` (then run the `db-migration` skill).
5. **Presentation**: `<plural>.controller.ts` injecting `CommandBus`/`QueryBus` only, validating
   with `@Body({ schema })` / `@Param('id', { schema })`, reading the actor with `@CurrentUser()`;
   `<name>-errors.filter.ts` mapping domain errors to HTTP.
6. **Module** `<plural>.module.ts`: import `CqrsModule`, register the handler arrays, bind both
   tokens to the chosen adapters; import it in `app.module.ts`.
7. **Tests**: `application/commands/<name>-commands.spec.ts` and `queries/<name>-queries.spec.ts`
   (in-memory adapter, fake EventBus), `test/<plural>.e2e-spec.ts` (use `TestAuth.createApp()`;
   override both new tokens with one in-memory instance).
8. **Web** (only if asked): `ticketsApi`-style client in `apps/web/src/lib/api.ts`, server actions,
   components.
9. Run the `verify` skill and report the files created.
