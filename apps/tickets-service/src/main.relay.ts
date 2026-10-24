import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { RelayModule } from './relay.module.js';

/** Entry point of the outbox relay: a headless process shipped as its own Docker image. */
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(RelayModule);
  app.enableShutdownHooks(); // lets the relay finish its batch and Prisma disconnect on SIGTERM
  new Logger('Relay').log('Outbox relay started');
}
await bootstrap();
