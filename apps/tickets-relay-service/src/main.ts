import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { useTelemetryLogger } from '@ticketmanager/telemetry';
import { AppModule } from './app.module.js';

/** Headless process: polls the tickets outbox and publishes to RabbitMQ (see @ticketmanager/outbox). */
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
  useTelemetryLogger(app);
  app.enableShutdownHooks(); // lets the relay finish its batch and close the pool/broker on SIGTERM
  new Logger('Relay').log('Tickets outbox relay started');
}
await bootstrap();
