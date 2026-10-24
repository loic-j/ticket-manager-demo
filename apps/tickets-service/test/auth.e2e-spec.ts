import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { TestAuth } from './utils/test-auth.js';

describe('Auth (e2e)', () => {
  let auth: TestAuth;
  let app: INestApplication<App>;

  beforeAll(async () => {
    auth = await TestAuth.create();
  });

  beforeEach(async () => {
    app = await auth.createApp();
  });

  afterEach(() => app.close());

  it('GET /health is public', () => {
    return request(app.getHttpServer()).get('/health').expect(200);
  });

  it('rejects a request without token', () => {
    return request(app.getHttpServer()).get('/tickets').expect(401);
  });

  it('rejects a malformed token', () => {
    return request(app.getHttpServer())
      .get('/tickets')
      .set('Authorization', 'Bearer not-a-jwt')
      .expect(401);
  });

  it('rejects a token for another audience', async () => {
    return request(app.getHttpServer())
      .get('/tickets')
      .set('Authorization', await auth.bearer({ audience: 'https://other.example' }))
      .expect(401);
  });

  it('rejects a token from another issuer', async () => {
    return request(app.getHttpServer())
      .get('/tickets')
      .set('Authorization', await auth.bearer({ issuer: 'https://evil.example/oidc' }))
      .expect(401);
  });

  it('rejects an expired token', async () => {
    return request(app.getHttpServer())
      .get('/tickets')
      .set('Authorization', await auth.bearer({ expiresIn: '-1m' }))
      .expect(401);
  });

  it('accepts a valid token', async () => {
    return request(app.getHttpServer())
      .get('/tickets')
      .set('Authorization', await auth.bearer())
      .expect(200);
  });
});
