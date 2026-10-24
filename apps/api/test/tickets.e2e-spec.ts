import { INestApplication, StandardSchemaValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Ticket } from '@ticketmanager/shared';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';

describe('Tickets (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new StandardSchemaValidationPipe());
    await app.init();
  });

  afterEach(() => app.close());

  it('POST /tickets validates with the shared schema', async () => {
    await request(app.getHttpServer()).post('/tickets').send({ title: '' }).expect(400);

    const res = await request(app.getHttpServer())
      .post('/tickets')
      .send({ title: 'New ticket' })
      .expect(201);

    const ticket = res.body as Ticket;
    expect(ticket.priority).toBe('medium');
    expect(ticket.description).toBe('');
  });

  it('GET /tickets/:id rejects a non-UUID id', () => {
    return request(app.getHttpServer()).get('/tickets/not-a-uuid').expect(400);
  });
});
