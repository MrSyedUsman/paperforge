import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureBodyParsers } from './app.setup.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  configureBodyParsers(app);
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: (process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000').split(','),
    allowedHeaders: ['Authorization', 'Content-Type'],
  });
  await app.listen(process.env.PORT ?? 4000);
}
await bootstrap();
