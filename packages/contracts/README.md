# @ticketmanager/contracts

Code shared between the services (NestJS) and the web app (Next.js): Zod schemas and the
TypeScript types inferred from them. This is the single source of truth for the HTTP contract.

- The services validate request payloads with these schemas (`@Body({ schema })`,
  `@Param('id', { schema })`, `@Query(..., { schema })`).
- The web app imports the inferred types (and can reuse the schemas for forms).
- `@ticketmanager/events` builds the integration event payloads from these schemas.

One folder per domain: `tickets/` (tickets-service API), `auth/` (`AuthUser`, the shared
`userIdSchema`), `notifications/` (notifications-service API), `directory/` (directory-service
API). Enums mirror the Prisma enums of the owning service (tickets-service for statuses and
priorities, notifications-service for notification kinds and delivery statuses).

The package is compiled with `tsc` to `dist/` (a "compiled package" in Turborepo terms), so
both apps consume plain JavaScript plus `.d.ts` files. `declarationMap` keeps go-to-definition
pointing at the `.ts` sources in your editor. Turborepo builds it before any dependent task.
