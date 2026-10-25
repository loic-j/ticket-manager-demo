# ADR 002 - directory-service: a synchronous, read-only user directory

Status: accepted · Date: 2026-10-25 · Amends ADR 001 ("Service-to-service calls: none synchronous")

## 1. Context

Tickets and notifications carry Logto user ids (`createdBy`, `updatedBy`, recipient). Two needs
appeared that events cannot serve:

- The web BFF wants to show "Created by Alice" on the ticket list. It needs the names **now**,
  while rendering the page; nothing in the ticket service knows or should know user profiles.
- notifications-service already resolved recipient emails through the Logto Management API with
  a machine-to-machine token. That knowledge (Management API resource, token flow, user shape,
  cache) belonged to one adapter in one service; the web would have needed a copy.

ADR 001 ruled out synchronous calls between services. That rule protected the asynchronous
tickets → notifications integration, where the caller does not need an answer. Here the caller
does: an answer that arrives later is useless to a page being rendered.

## 2. Decision

Add `apps/directory-service`, a **read-only facade** over the Logto Management API, and call it
**synchronously** from the web BFF and from notifications-service.

- Routes: `GET /users?ids=a,b,c` (batch, at most `DIRECTORY_BATCH_MAX_IDS` = 50 distinct ids,
  unknown ids omitted, request order kept) and `GET /users/:id` (404 when unknown). Views are
  `DirectoryUser { id, name, email, avatar }` from `@ticketmanager/contracts`.
- No database, no broker. The only state is an in-memory cache (`CachingUserDirectory`:
  `DIRECTORY_CACHE_TTL_MS` = 10 min for found profiles, 60 s for unknown ids,
  `DIRECTORY_CACHE_MAX_SIZE` = 1000, oldest-first eviction). Logto has no batch endpoint, so the
  Logto adapter fans out with at most 8 lookups in flight.
- Layout follows the project rules (`users` context: `domain/` error, `application/ports` +
  `queries` through `QueryBus`, `infrastructure/` adapters + cache decorator, `presentation/`
  controller + filter). The cache is a decorator bound to the `USER_DIRECTORY` token.
- Service-to-service plumbing lives in `@ticketmanager/nest-common` (`http/`):
  `ClientCredentialsTokenProvider` / `logtoClientCredentials` (cached `client_credentials` token,
  single in-flight refresh) and `ServiceHttpClient` (bearer injection, 5 s timeout, one retry with
  a fresh token on 401, optional `x-correlation-id` passthrough). Only directory-service knows the
  Logto Management API specifics.

## 3. Topology

```
web (BFF) ──user token (aud directory)──► directory-service (:3003) ──M2M token (Management API)──► Logto
notifications-service ──M2M token (aud directory)──► directory-service
tickets-service ──events──► RabbitMQ ──► notifications-service        (unchanged, asynchronous)
```

The web requests a token for a third resource (`DIRECTORY_API_RESOURCE`); existing sessions
sign in again once.

## 4. Auth

- Logto: API resource `https://directory.ticketmanager.local` with permission `read:users`;
  M2M role `directory-client` granting it; the M2M application holds that role (to call the
  directory) and _Logto Management API access_ (used by the directory itself). Least privilege:
  two M2M apps, same variable names, different values per service.
- The shared guard checks issuer and audience only, as in every service: user tokens (web, no
  scope) and M2M tokens (`sub` = app id) are both accepted. Enforcing `read:users` would reject
  the web's user tokens until Logto user roles exist; it is deferred to the RBAC step already
  listed in the README.

## 5. Failure modes

| Caller                | When directory-service is down or slow                                                                                                 |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| web                   | `directoryApi.getUsers()` fails soft: the list renders with raw ids (`userLabel`).                                                     |
| notifications-service | `HttpUserDirectory` throws; the email is recorded `failed` and the retry worker tries again.                                           |
| directory-service     | Without M2M credentials outside production: every id is unknown, one warning. In production the service refuses to start without them. |

A directory outage therefore never blocks a ticket write, a page or the delivery pipeline; it
degrades names and delays emails.

## 6. What this amends in ADR 001

"Service-to-service calls: none synchronous" becomes: **asynchronous by default; a synchronous
call is acceptable for a read-only lookup whose answer the caller needs to produce its own
response, provided it is cached and every caller degrades gracefully.** Writes, validations that
gate another service's writes, and anything a caller does not need to answer stay asynchronous.

## 7. Follow-ups

- Enforce `read:users` (and `tickets:*`) once Logto roles exist for users (`@RequireScopes()`).
- Show the creator on the ticket edit page (single-id lookup) if useful.
- Propagate a request-scoped correlation id over HTTP (ADR 001 §4.6); `ServiceHttpClient`
  already forwards one when given.
- A `missing: string[]` field in the batch response if callers need to tell "unknown" from
  "not asked".
