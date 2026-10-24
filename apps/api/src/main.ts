import { StandardSchemaValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Validates any @Body()/@Query()/@Param() that declares a `schema` (Zod, Valibot, ...).
  app.useGlobalPipes(new StandardSchemaValidationPipe());

  app.enableCors({
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(','),
  });

  await app.listen(process.env.PORT ?? 3001);
}
await bootstrap();
