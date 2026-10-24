# packages/nest-common (@ticketmanager/nest-common)

- Shared NestJS building blocks only (auth today; outbox/inbox modules later). No business logic.
- Exports go through `src/index.ts`; relative imports end with `.js`; decorators enabled by the
  `nest-library.json` preset.
- `AuthModule.forRoot({ defaultAudience })` registers the global guard; a service must pass its
  own API resource. Tests replace `JwtVerifier` by `overrideProvider`.
- Changing the guard or the config affects every service: run the whole `verify` suite.
