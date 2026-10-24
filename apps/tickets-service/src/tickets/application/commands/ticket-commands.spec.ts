import { ImmediateUnitOfWork, InMemoryOutbox } from '../../../messaging/infrastructure/testing.js';
import { TicketNotFoundError } from '../../domain/ticket-not-found.error.js';
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

  beforeEach(() => {
    store = new InMemoryTicketRepository();
    outbox = new InMemoryOutbox();
  });

  it('creates an open ticket attributed to the actor and appends ticket.created', async () => {
    const id = await new CreateTicketHandler(store, uow, outbox).execute(
      new CreateTicketCommand(
        { title: 'Broken keyboard', description: '', priority: 'high' },
        'user_a',
      ),
    );
    expect(await store.findById(id)).toMatchObject({
      status: 'open',
      createdBy: 'user_a',
      updatedBy: 'user_a',
    });
    expect(types()).toEqual(['ticket.created']);
    expect(outbox.events[0]).toMatchObject({ aggregateType: 'ticket', aggregateId: id });
    expect(outbox.events[0]!.envelope.payload).toMatchObject({ ticketId: id, createdBy: 'user_a' });
  });

  it('updates fields, records the editor and appends updated + status-changed', async () => {
    const id = await new CreateTicketHandler(store, uow, outbox).execute(
      new CreateTicketCommand({ title: 'A', description: '', priority: 'low' }, 'user_a'),
    );
    await new UpdateTicketHandler(store, uow, outbox).execute(
      new UpdateTicketCommand(id, { status: 'resolved', title: 'A2' }, 'user_b'),
    );
    expect(await store.findById(id)).toMatchObject({
      status: 'resolved',
      title: 'A2',
      createdBy: 'user_a',
      updatedBy: 'user_b',
    });
    expect(types()).toEqual(['ticket.created', 'ticket.updated', 'ticket.status-changed']);
    expect(outbox.events[1]!.envelope.payload).toMatchObject({
      changedFields: ['status', 'title'],
    });
    expect(outbox.events[2]!.envelope.payload).toMatchObject({
      from: 'open',
      to: 'resolved',
      changedBy: 'user_b',
    });
  });

  it('is a no-op when nothing changes', async () => {
    const id = await new CreateTicketHandler(store, uow, outbox).execute(
      new CreateTicketCommand({ title: 'A', description: '', priority: 'low' }, 'user_a'),
    );
    const before = await store.findById(id);
    await new UpdateTicketHandler(store, uow, outbox).execute(
      new UpdateTicketCommand(id, { title: 'A' }, 'user_b'),
    );
    expect(await store.findById(id)).toEqual(before);
    expect(types()).toEqual(['ticket.created']);
  });

  it('deletes and appends ticket.deleted; unknown ids raise TicketNotFoundError', async () => {
    const id = await new CreateTicketHandler(store, uow, outbox).execute(
      new CreateTicketCommand({ title: 'A', description: '', priority: 'low' }, 'user_a'),
    );
    const handler = new DeleteTicketHandler(store, uow, outbox);
    await handler.execute(new DeleteTicketCommand(id, 'user_a'));
    expect(await store.findById(id)).toBeNull();
    expect(types().at(-1)).toBe('ticket.deleted');

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
