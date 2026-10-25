# @ticketmanager/typescript-config

Shared `tsconfig` presets. Extend one of them from each package:

| Preset              | Use for                                                                                |
| ------------------- | -------------------------------------------------------------------------------------- |
| `base.json`         | Strictness options shared by every preset                                              |
| `node-library.json` | Plain TypeScript libraries compiled with `tsc`                                         |
| `nest-library.json` | Libraries using NestJS decorators (`nest-common`): `node-library` + decorator metadata |
| `nestjs.json`       | NestJS applications (decorator metadata, Node)                                         |
| `nextjs.json`       | Next.js applications (bundler resolution, DOM)                                         |
