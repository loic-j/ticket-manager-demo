import { StandardSchemaValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { useTelemetryLogger } from '@ticketmanager/telemetry';
import { AppModule } from './app.module.js';

async function bootstrap() {
  // Logs are buffered until pino takes over, so startup lines are structured too.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  useTelemetryLogger(app);
  const config = app.get(ConfigService);

  // Validates any @Body()/@Query()/@Param() that declares a `schema` (Zod, Valibot, ...).
  app.useGlobalPipes(new StandardSchemaValidationPipe());
  app.enableCors({ origin: config.get<string>('CORS_ORIGIN', 'http://localhost:3000').split(',') });
  app.enableShutdownHooks(); // lets the consumer and Prisma stop cleanly on SIGTERM

  await app.listen(config.get<number>('PORT', 3002));
}
await bootstrap();
