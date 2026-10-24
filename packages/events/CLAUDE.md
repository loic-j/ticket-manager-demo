# packages/events (@ticketmanager/events)

- Integration events only (what crosses service boundaries); domain events stay inside a service.
- One file per domain: `src/<domain>/<domain>.events.ts` exporting `defineEvent(type, version,
payloadSchema)` results, re-exported from `src/index.ts`.
- Breaking payload change = new version (`ticket.created` v2), never edit a published version.
  Payloads carry ids and minimal data, never whole aggregates.
- Routing key = `type`; `id` is the dedup key for consumers.
