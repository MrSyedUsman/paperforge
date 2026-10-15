import { Body, Controller, Post, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Module } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { configureBodyParsers } from './app.setup.js';

@Controller()
class EchoController {
  @Post('auth/login') login(@Body() body: unknown) { return { body }; }
  @Post('arena-debriefs') debrief(@Body() body: unknown) { return { size: JSON.stringify(body).length }; }
}
@Module({ controllers: [EchoController] })
class EchoModule {}

describe('body parsers', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const nest = await NestFactory.create<NestExpressApplication>(EchoModule, { bodyParser: false, logger: false });
    configureBodyParsers(nest);
    nest.setGlobalPrefix('api');
    await nest.init();
    app = nest;
  });
  afterAll(() => app.close());

  it('still parses JSON on ordinary routes such as login', async () => {
    const res = await request(app.getHttpServer()).post('/api/auth/login').send({ username: 'forge', password: 'x' });
    expect(res.status).toBe(201);
    expect(res.body.body).toEqual({ username: 'forge', password: 'x' });
  });
  it('keeps the small default limit on ordinary routes', async () => {
    const res = await request(app.getHttpServer()).post('/api/auth/login').send({ text: 'a'.repeat(200_000) });
    expect(res.status).toBe(413);
  });
  it('accepts larger bodies on the arena routes', async () => {
    const res = await request(app.getHttpServer()).post('/api/arena-debriefs').send({ text: 'a'.repeat(200_000) });
    expect(res.status).toBe(201);
    expect(res.body.size).toBeGreaterThan(200_000);
  });
});
