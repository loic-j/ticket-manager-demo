# @ticketmanager/nest-common

Code shared by the NestJS services. Compiled with `tsc` (ESM); consumers import `dist/`.

- **auth**: Logto access-token verification (`AuthModule`, `AccessTokenGuard`, `JwtVerifier`:
  JWKS signature, `ES384`/`RS256` only, `typ: at+jwt`, issuer, audience, 5 s clock tolerance),
  the `@Public()` and `@CurrentUser()` decorators and the `AuthenticatedRequest` type. A token
  the verifier rejects is a 401; a verifier that cannot reach the JWKS is a 503.
- **http**: `ServiceHttpClient` (bearer token from a `TokenProvider`, timeout, one retry with a
  fresh token on 401) and `logtoClientCredentials()` (OAuth 2 `client_credentials` against Logto
  with an in-memory token cache). Every synchronous service-to-service call goes through them.
- **config**: `readEnv(schema, configService | env)` reads the keys of a Zod object schema through
  `ConfigService` (or a plain object in tests) and validates them.
- **testing** (`@ticketmanager/nest-common/testing`): `LocalTokenIssuer`, a key pair standing in
  for Logto in e2e tests (`token()`, `bearer()`, `verifier` to override `JwtVerifier`).

```ts
// app.module.ts of a service
AuthModule.forRoot({ defaultAudience: TICKETS_API_RESOURCE });
```

`LOGTO_ENDPOINT` and `LOGTO_API_RESOURCE` override the defaults at runtime.
