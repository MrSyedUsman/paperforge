import { json } from 'express';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use('/api/arena-debriefs', json({limit:'700kb'}));
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: (process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000').split(','),
    allowedHeaders: ['Authorization', 'Content-Type'],
  });
  await app.listen(process.env.PORT ?? 4000);
}
await bootstrap();
