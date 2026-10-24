# @ticketmanager/nest-common

Code shared by the NestJS services: Logto access-token verification (`AuthModule`,
`AccessTokenGuard`, `JwtVerifier`), the `@Public()` and `@CurrentUser()` decorators and the
`AuthenticatedRequest` type. Compiled with `tsc` (ESM); consumers import `dist/`.

```ts
// app.module.ts of a service
AuthModule.forRoot({ defaultAudience: TICKETS_API_RESOURCE });
```

`LOGTO_ENDPOINT` and `LOGTO_API_RESOURCE` override the defaults at runtime.
