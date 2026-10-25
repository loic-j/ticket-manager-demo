# packages/nest-common (@ticketmanager/nest-common)

- Shared NestJS building blocks only, no business logic: `auth/` (Logto access-token guard and
  decorators), `http/` (`ServiceHttpClient` + `logtoClientCredentials`, the only sanctioned way to
  call another service synchronously), `config/` (`readEnv(schema, source)`, used by every
  service config loader), `testing/` (`LocalTokenIssuer`, exported through the
  `@ticketmanager/nest-common/testing` subpath so it never ships in a production entry point).
- Exports go through `src/index.ts` (and `src/testing/index.ts` for the test subpath); relative
  imports end with `.js`; decorators enabled by the `nest-library.json` preset.
- `AuthModule.forRoot({ defaultAudience })` registers the global guard; a service must pass its
  own API resource. Tests replace `JwtVerifier` by `overrideProvider` with
  `LocalTokenIssuer.verifier`.
- Changing the guard, the verifier or the HTTP client affects every service: run the whole
  `verify` suite.
