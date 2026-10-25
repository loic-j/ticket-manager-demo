import { StandardSchemaValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Validates any @Body()/@Query()/@Param() that declares a `schema` (Zod, Valibot, ...).
  app.useGlobalPipes(new StandardSchemaValidationPipe());
  app.enableCors({ origin: config.get<string>('CORS_ORIGIN', 'http://localhost:3000').split(',') });
  app.enableShutdownHooks(); // runs `onModuleDestroy` (Prisma disconnect) on SIGTERM

  await app.listen(config.get<number>('PORT', 3001));
}
await bootstrap();
