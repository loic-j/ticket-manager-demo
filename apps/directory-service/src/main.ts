import { StandardSchemaValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Validates any @Body()/@Query()/@Param() that declares a `schema` (Zod, Valibot, ...).
  app.useGlobalPipes(new StandardSchemaValidationPipe());
  // No CORS: the directory is only called server-side (web BFF, other services).
  app.enableShutdownHooks();

  await app.listen(config.get<number>('PORT', 3003));
}
await bootstrap();
