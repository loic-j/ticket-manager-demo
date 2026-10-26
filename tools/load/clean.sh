#!/usr/bin/env bash
# Removes everything the load tests left behind: pnpm load:clean [--mail]
# - tickets created by the load-test app (and their outbox rows) in tickets-db
# - notifications, ticket versions and inbox rows of those tickets in notifications-db
# - with --mail: every message in Mailpit (the load emails all go to the dev fallback address)
# Scenarios delete their tickets themselves; this covers aborted runs and the consumer-side rows.
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
app_id="$(grep -E '^LOADTEST_APP_ID=' "$root/tools/load/.env" 2>/dev/null | cut -d= -f2- | tr -d '[:space:]"' || true)"
[ -n "$app_id" ] || { echo "LOADTEST_APP_ID not found in tools/load/.env" >&2; exit 1; }
case "$app_id" in *[!A-Za-z0-9_-]*) echo "unexpected characters in LOADTEST_APP_ID" >&2; exit 1;; esac

tickets_sql="
WITH mine AS (SELECT id FROM tickets WHERE created_by = '${app_id}'),
     deleted_outbox AS (
       DELETE FROM outbox_messages
        WHERE aggregate_id IN (SELECT id FROM mine)
           OR payload -> 'payload' -> 'ticket' ->> 'createdBy' = '${app_id}'
           OR payload -> 'payload' ->> 'deletedBy' = '${app_id}'
        RETURNING 1),
     deleted_tickets AS (DELETE FROM tickets WHERE id IN (SELECT id FROM mine) RETURNING 1)
SELECT (SELECT count(*) FROM deleted_tickets) AS tickets, (SELECT count(*) FROM deleted_outbox) AS outbox_rows;"
notifications_sql="
WITH mine AS (SELECT id, ticket_id, event_id FROM notifications WHERE user_id = '${app_id}'),
     v AS (DELETE FROM ticket_versions WHERE ticket_id IN (SELECT ticket_id FROM mine) RETURNING 1),
     p AS (DELETE FROM processed_events WHERE event_id IN (SELECT event_id FROM mine) RETURNING 1),
     n AS (DELETE FROM notifications WHERE id IN (SELECT id FROM mine) RETURNING 1)
SELECT (SELECT count(*) FROM n) AS notifications, (SELECT count(*) FROM v) AS ticket_versions, (SELECT count(*) FROM p) AS inbox_rows;"

echo "tickets-db:"
docker exec ticketmanager-tickets-db-1 psql -U tickets -d tickets -c "$tickets_sql"
echo "notifications-db:"
docker exec ticketmanager-notifications-db-1 psql -U notifications -d notifications -c "$notifications_sql"
if [ "${2:-${1:-}}" = "--mail" ]; then
  echo "mailpit: deleting every message"
  curl -sf -X DELETE http://localhost:8025/api/v1/messages >/dev/null && echo "done"
fi
