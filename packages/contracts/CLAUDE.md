# packages/contracts (@ticketmanager/contracts)

- The API contract: Zod schemas + inferred types + constants, nothing else (no React, no NestJS).
- One folder per domain (`src/tickets/`, `src/auth/`, `src/notifications/`, `src/directory/`),
  each with an `index.ts` re-exported from `src/index.ts`. File names: `<name>.schema.ts`,
  `<name>.constants.ts`, tests `*.test.ts`.
- Export both the schema and its types: `fooSchema`, `Foo` (`z.infer`), and for inputs with
  defaults `FooInput` (`z.input`) + `FooDto` (`z.output`).
- Shared primitives live where they are defined once: `userIdSchema` (`src/auth/`) is the Logto
  `sub` used by `authUserSchema.sub`, `ticketSchema.createdBy/updatedBy` and
  `directoryUserIdSchema`; never redeclare a user id bound in a domain folder.
- Compiled package: consumers import `dist/`, so run `pnpm --filter @ticketmanager/contracts build`
  (or any Turbo task, which does it) after editing. Relative imports end with `.js`.
- Enums are `as const` arrays + `z.enum`; keep them in sync with the Prisma enums of the service
  that persists them: `TICKET_STATUSES` / `TICKET_PRIORITIES` in `apps/tickets-service`,
  `NOTIFICATION_KINDS` / `NOTIFICATION_DELIVERY_STATUSES` in `apps/notifications-service`.
