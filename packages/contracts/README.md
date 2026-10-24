# @ticketmanager/contracts

Code shared between the API (NestJS) and the web app (Next.js): Zod schemas and the
TypeScript types inferred from them. This is the single source of truth for the API contract.

- The API validates request payloads with these schemas (`@Body({ schema })`).
- The web app imports the inferred types (and can reuse the schemas for forms).

The package is compiled with `tsc` to `dist/` (a "compiled package" in Turborepo terms), so
both apps consume plain JavaScript plus `.d.ts` files. `declarationMap` keeps go-to-definition
pointing at the `.ts` sources in your editor. Turborepo builds it before any dependent task.
