# packages/contracts (@ticketmanager/contracts)

- The API contract: Zod schemas + inferred types + constants, nothing else (no React, no NestJS).
- One folder per domain (`src/tickets/`, `src/auth/`), each with an `index.ts` re-exported from
  `src/index.ts`. File names: `<name>.schema.ts`, `<name>.constants.ts`, tests `*.test.ts`.
- Export both the schema and its types: `fooSchema`, `Foo` (`z.infer`), and for inputs with
  defaults `FooInput` (`z.input`) + `FooDto` (`z.output`).
- Compiled package: consumers import `dist/`, so run `pnpm --filter @ticketmanager/contracts build`
  (or any Turbo task, which does it) after editing. Relative imports end with `.js`.
- Enums are `as const` arrays + `z.enum`; keep them in sync with the Prisma enums in `apps/tickets-service`.
