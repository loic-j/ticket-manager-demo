import type { INestApplication } from '@nestjs/common';
import { DIRECTORY_BATCH_MAX_IDS, type DirectoryUsersResponse } from '@ticketmanager/contracts';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { user } from '../src/users/infrastructure/testing.js';
import { TestAuth } from './utils/test-auth.js';

describe('Users (e2e)', () => {
  let auth: TestAuth;
  let app: INestApplication<App>;
  let bearer: string;

  beforeAll(async () => {
    auth = await TestAuth.create();
    bearer = await auth.bearer();
  });

  beforeEach(async () => {
    app = await auth.createApp();
  });

  afterEach(() => app.close());

  it('GET /health is public, /users needs a token', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
    await request(app.getHttpServer()).get('/users?ids=u1').expect(401);
    await request(app.getHttpServer()).get('/users/u1').expect(401);
  });

  it('GET /users/:id returns the profile or 404', async () => {
    const res = await request(app.getHttpServer())
      .get('/users/u1')
      .set('Authorization', bearer)
      .expect(200);
    expect(res.body).toEqual(user('u1', 'Alice'));
    await request(app.getHttpServer()).get('/users/ghost').set('Authorization', bearer).expect(404);
  });

  it('GET /users?ids= batches, omits unknown ids and validates the list', async () => {
    const res = await request(app.getHttpServer())
      .get('/users?ids=u2,ghost,u1,u2')
      .set('Authorization', bearer)
      .expect(200);
    expect((res.body as DirectoryUsersResponse).users).toEqual([
      user('u2', null),
      user('u1', 'Alice'),
    ]);

    const repeated = await request(app.getHttpServer())
      .get('/users?ids=u1&ids=u2')
      .set('Authorization', bearer)
      .expect(200);
    expect((repeated.body as DirectoryUsersResponse).users.map((u) => u.id)).toEqual(['u1', 'u2']);

    await request(app.getHttpServer()).get('/users').set('Authorization', bearer).expect(400);
    await request(app.getHttpServer()).get('/users?ids=').set('Authorization', bearer).expect(400);
    const tooMany = Array.from({ length: DIRECTORY_BATCH_MAX_IDS + 1 }, (_, i) => `x${i}`).join(
      ',',
    );
    await request(app.getHttpServer())
      .get(`/users?ids=${tooMany}`)
      .set('Authorization', bearer)
      .expect(400);
  });

  it('accepts a machine token (sub = app id) for the same audience', async () => {
    await request(app.getHttpServer())
      .get('/users/u1')
      .set('Authorization', await auth.bearer({ sub: 'm2m_app_id' }))
      .expect(200);
    await request(app.getHttpServer())
      .get('/users/u1')
      .set('Authorization', await auth.bearer({ audience: 'https://other.local' }))
      .expect(401);
  });
});
