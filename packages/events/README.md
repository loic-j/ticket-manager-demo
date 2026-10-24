# @ticketmanager/events

Integration events exchanged between services through RabbitMQ: the envelope, a `defineEvent`
helper and the versioned payload schemas per domain (`src/tickets/`). Publishers build events
with `event.create(payload, meta)`; consumers validate with `event.schema` or `parseEnvelope`.
