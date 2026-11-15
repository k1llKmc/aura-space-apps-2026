import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { z } from 'zod';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

const environmentSchema = z.object({ API_PORT: z.coerce.number().int().min(1).max(65535).default(3001) });

async function bootstrap(): Promise<void> {
  const environment = environmentSchema.parse(process.env);
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(environment.API_PORT, '0.0.0.0');
  new Logger('Bootstrap').log(`AURA API listening on port ${environment.API_PORT}`);
}
void bootstrap();
