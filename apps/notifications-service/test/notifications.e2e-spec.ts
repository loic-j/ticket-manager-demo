import type { INestApplication } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import type { Notification } from '@ticketmanager/contracts';
import { ticketCreatedV1 } from '@ticketmanager/events';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { HandleTicketEventCommand } from '../src/notifications/application/commands/index.js';
import { TestAuth } from './utils/test-auth.js';

describe('Notifications (e2e)', () => {
  let auth: TestAuth;
  let app: INestApplication<App>;
  let bearer: string;

  beforeAll(async () => {
    auth = await TestAuth.create();
    bearer = await auth.bearer();
  });

  beforeEach(async () => {
    app = await auth.createApp();
    auth.notifications.rows.clear();
  });

  afterEach(() => app.close());

  it('GET /health is public, GET /notifications needs a token', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
    await request(app.getHttpServer()).get('/notifications').expect(401);
  });

  it('lists only the caller notifications, newest first, and marks them read', async () => {
    const commandBus = app.get(CommandBus);
    const mine = ticketCreatedV1.create({
      ticketId: '2f6a3c4e-5b1d-4e8a-9c7f-1a2b3c4d5e6f',
      title: 'Mine',
      priority: 'low',
      createdBy: 'user_test',
    });
    const theirs = ticketCreatedV1.create({
      ticketId: '3f6a3c4e-5b1d-4e8a-9c7f-1a2b3c4d5e6f',
      title: 'Theirs',
      priority: 'low',
      createdBy: 'user_other',
    });
    await commandBus.execute(new HandleTicketEventCommand(theirs));
    await commandBus.execute(new HandleTicketEventCommand(mine));

    const res = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', bearer)
      .expect(200);
    const list = res.body as Notification[];
    expect(list.map((n) => n.title)).toEqual(['Ticket created: Mine']);
    expect(list[0]).not.toHaveProperty('userId');
    expect(auth.mailer.sent.map((m) => m.to)).toEqual(['test@example.com']); // user_other has no email

    await request(app.getHttpServer())
      .post(`/notifications/${list[0]!.id}/read`)
      .set('Authorization', bearer)
      .expect(204);
    const after = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', bearer)
      .expect(200);
    expect((after.body as Notification[])[0]!.readAt).not.toBeNull();

    await request(app.getHttpServer())
      .post(`/notifications/${list[0]!.id}/read`)
      .set('Authorization', await auth.bearer({ sub: 'user_other' }))
      .expect(404);
    await request(app.getHttpServer())
      .post('/notifications/not-a-uuid/read')
      .set('Authorization', bearer)
      .expect(400);
  });
});
