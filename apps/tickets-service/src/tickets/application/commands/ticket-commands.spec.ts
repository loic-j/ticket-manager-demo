import { ImmediateUnitOfWork, InMemoryOutbox } from '../../../messaging/infrastructure/testing.js';
import { ConcurrencyConflictError } from '../../domain/concurrency-conflict.error.js';
import { TicketNotFoundError } from '../../domain/ticket-not-found.error.js';
import type { TicketRepository } from '../../domain/ticket.repository.js';
import { InMemoryTicketRepository } from '../../infrastructure/in-memory-ticket.repository.js';
import { CreateTicketCommand } from './create-ticket.command.js';
import { CreateTicketHandler } from './create-ticket.handler.js';
import { DeleteTicketCommand } from './delete-ticket.command.js';
import { DeleteTicketHandler } from './delete-ticket.handler.js';
import { UpdateTicketCommand } from './update-ticket.command.js';
import { UpdateTicketHandler } from './update-ticket.handler.js';

describe('ticket command handlers', () => {
  let store: InMemoryTicketRepository;
  let outbox: InMemoryOutbox;
  const uow = new ImmediateUnitOfWork();
  const types = () => outbox.events.map((e) => e.envelope.type);
  const create = (actor = 'user_a') =>
    new CreateTicketHandler(store, uow, outbox).execute(
      new CreateTicketCommand({ title: 'A', description: '', priority: 'low' }, actor),
    );

  beforeEach(() => {
    store = new InMemoryTicketRepository();
    outbox = new InMemoryOutbox();
  });

  it('creates an open ticket at version 1 and appends ticket.created with the state', async () => {
    const id = await create();
    const ticket = await store.findById(id);
    expect(ticket).toMatchObject({ status: 'open', createdBy: 'user_a', version: 1 });
    expect(types()).toEqual(['ticket.created']);
    expect(outbox.events[0]!.envelope.payload).toEqual({ ticket });
  });

  it('updates fields, bumps the version and appends ticket.changed', async () => {
    const id = await create();
    await new UpdateTicketHandler(store, uow, outbox).execute(
      new UpdateTicketCommand(id, { status: 'resolved', title: 'A2' }, 'user_b'),
    );
    expect(await store.findById(id)).toMatchObject({
      status: 'resolved',
      title: 'A2',
      updatedBy: 'user_b',
      version: 2,
    });
    expect(types()).toEqual(['ticket.created', 'ticket.changed']);
    expect(outbox.events[1]!.envelope.payload).toMatchObject({
      ticket: { version: 2, status: 'resolved' },
      changedFields: ['status', 'title'],
      previousStatus: 'open',
    });
  });

  it('is a no-op when nothing changes', async () => {
    const id = await create();
    const before = await store.findById(id);
    await new UpdateTicketHandler(store, uow, outbox).execute(
      new UpdateTicketCommand(id, { title: 'A' }, 'user_b'),
    );
    expect(await store.findById(id)).toEqual(before);
    expect(types()).toEqual(['ticket.created']);
  });

  it('retries on a concurrent change and gives up after three conflicts', async () => {
    const id = await create();
    let conflicts = 0;
    const flaky: TicketRepository = {
      findById: (i) => store.findById(i),
      insert: (t) => store.insert(t),
      delete: (i) => store.delete(i),
      update: async (t) => {
        if (conflicts < 2) {
          conflicts++;
          return false; // someone else won the race twice
        }
        return store.update(t);
      },
    };
    await new UpdateTicketHandler(flaky, uow, outbox).execute(
      new UpdateTicketCommand(id, { title: 'B' }, 'user_b'),
    );
    expect(await store.findById(id)).toMatchObject({ title: 'B', version: 2 });
    expect(types()).toEqual(['ticket.created', 'ticket.changed']); // conflicts appended nothing

    const alwaysConflicting: TicketRepository = { ...flaky, update: async () => false };
    await expect(
      new UpdateTicketHandler(alwaysConflicting, uow, outbox).execute(
        new UpdateTicketCommand(id, { title: 'C' }, 'user_b'),
      ),
    ).rejects.toBeInstanceOf(ConcurrencyConflictError);
  });

  it('deletes with a superseding version; unknown ids raise TicketNotFoundError', async () => {
    const id = await create();
    const handler = new DeleteTicketHandler(store, uow, outbox);
    await handler.execute(new DeleteTicketCommand(id, 'user_a'));
    expect(await store.findById(id)).toBeNull();
    expect(outbox.events.at(-1)!.envelope).toMatchObject({
      type: 'ticket.deleted',
      payload: { ticketId: id, version: 2 },
    });

    await expect(handler.execute(new DeleteTicketCommand(id, 'user_a'))).rejects.toBeInstanceOf(
      TicketNotFoundError,
    );
    await expect(
      new UpdateTicketHandler(store, uow, outbox).execute(
        new UpdateTicketCommand(id, {}, 'user_a'),
      ),
    ).rejects.toBeInstanceOf(TicketNotFoundError);
  });
});
