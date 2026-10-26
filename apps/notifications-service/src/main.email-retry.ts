import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { useTelemetryLogger } from '@ticketmanager/telemetry';
import { EmailRetryWorkerModule } from './email-retry-worker.module.js';

/** Entry point of the email retry worker: a headless process shipped as its own Docker image. */
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(EmailRetryWorkerModule, {
    bufferLogs: true,
  });
  useTelemetryLogger(app);
  app.enableShutdownHooks();
  new Logger('EmailRetry').log('Email retry worker started');
}
await bootstrap();
