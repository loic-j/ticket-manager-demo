import type { INestApplication } from '@nestjs/common';
import type { Ticket } from '@ticketmanager/contracts';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { TestAuth } from './utils/test-auth.js';

describe('Tickets (e2e)', () => {
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

  it('POST /tickets validates with the shared schema', async () => {
    await request(app.getHttpServer())
      .post('/tickets')
      .set('Authorization', bearer)
      .send({ title: '' })
      .expect(400);

    const res = await request(app.getHttpServer())
      .post('/tickets')
      .set('Authorization', bearer)
      .send({ title: 'New ticket' })
      .expect(201);

    const ticket = res.body as Ticket;
    expect(ticket.priority).toBe('medium');
    expect(ticket.description).toBe('');
    expect(ticket.createdBy).toBe('user_test');
    expect(ticket.updatedBy).toBe('user_test');
    expect(ticket.version).toBe(1);
    expect(auth.outbox.events.at(-1)?.envelope).toMatchObject({
      type: 'ticket.created',
      payload: { ticket: { id: ticket.id, version: 1 } },
    });
  });

  it('GET /tickets/:id returns 404 for an unknown ticket', () => {
    return request(app.getHttpServer())
      .get('/tickets/2f6a3c4e-5b1d-4e8a-9c7f-1a2b3c4d5e6f')
      .set('Authorization', bearer)
      .expect(404);
  });

  it('GET /tickets/:id rejects a non-UUID id', () => {
    return request(app.getHttpServer())
      .get('/tickets/not-a-uuid')
      .set('Authorization', bearer)
      .expect(400);
  });

  it('PATCH and DELETE go through the command side', async () => {
    const created = await request(app.getHttpServer())
      .post('/tickets')
      .set('Authorization', bearer)
      .send({ title: 'To update' })
      .expect(201);
    const { id } = created.body as Ticket;

    const other = await auth.bearer({ sub: 'user_other' });
    const updated = await request(app.getHttpServer())
      .patch(`/tickets/${id}`)
      .set('Authorization', other)
      .send({ status: 'in_progress' })
      .expect(200);
    expect(updated.body).toMatchObject({
      status: 'in_progress',
      createdBy: 'user_test',
      updatedBy: 'user_other',
    });

    await request(app.getHttpServer())
      .delete(`/tickets/${id}`)
      .set('Authorization', bearer)
      .expect(204);
    await request(app.getHttpServer())
      .get(`/tickets/${id}`)
      .set('Authorization', bearer)
      .expect(404);
  });

  it('PATCH /tickets/:id returns 409 when expectedVersion is stale', async () => {
    const created = await request(app.getHttpServer())
      .post('/tickets')
      .set('Authorization', bearer)
      .send({ title: 'Edited from a stale copy' })
      .expect(201);
    const { id } = created.body as Ticket;

    await request(app.getHttpServer())
      .patch(`/tickets/${id}`)
      .set('Authorization', bearer)
      .send({ title: 'Nope', expectedVersion: 99 })
      .expect(409);

    const fresh = await request(app.getHttpServer())
      .patch(`/tickets/${id}`)
      .set('Authorization', bearer)
      .send({ title: 'Yes', expectedVersion: 1 })
      .expect(200);
    expect(fresh.body).toMatchObject({ title: 'Yes', version: 2 });
  });

  it('PATCH /tickets/:id rejects an invalid body', async () => {
    const created = await request(app.getHttpServer())
      .post('/tickets')
      .set('Authorization', bearer)
      .send({ title: 'Valid' })
      .expect(201);
    const { id } = created.body as Ticket;

    await request(app.getHttpServer())
      .patch(`/tickets/${id}`)
      .set('Authorization', bearer)
      .send({ status: 'not-a-status' })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/tickets/${id}`)
      .set('Authorization', bearer)
      .send({ title: 'x', expectedVersion: 0 })
      .expect(400);
  });

  it('PATCH and DELETE return 404 for an unknown ticket', async () => {
    const unknown = '/tickets/2f6a3c4e-5b1d-4e8a-9c7f-1a2b3c4d5e6f';
    await request(app.getHttpServer())
      .patch(unknown)
      .set('Authorization', bearer)
      .send({ title: 'Ghost' })
      .expect(404);
    await request(app.getHttpServer()).delete(unknown).set('Authorization', bearer).expect(404);
  });
});
