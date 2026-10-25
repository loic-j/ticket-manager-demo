# packages/events (@ticketmanager/events)

- Integration events only (what crosses service boundaries); domain events stay inside a service.
- One file per domain: `src/<domain>/<domain>.events.ts` exporting `defineEvent(type, version,
payloadSchema)` results, re-exported from `src/index.ts`.
- Breaking payload change = new version (`ticket.created` v2), never edit a published version.
  Payloads carry the aggregate's full state with its `version` (consumers must be order-independent);
  `ticket.changed` adds `changes` = `{ field: { from, to } }` so consumers never need a local history.
- Routing key = `type`; `id` is the dedup key for consumers.
