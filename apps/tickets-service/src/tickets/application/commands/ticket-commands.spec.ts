import type { EventBus } from '@nestjs/cqrs';
import {
  TicketCreatedEvent,
  TicketDeletedEvent,
  TicketStatusChangedEvent,
  TicketUpdatedEvent,
} from '../../domain/events/ticket-events.js';
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
  let published: unknown[];
  let eventBus: EventBus;

  beforeEach(() => {
    store = new InMemoryTicketRepository();
    published = [];
    eventBus = {
      publish: async (event: unknown) => {
        published.push(event);
      },
      publishAll: async (events: unknown[]) => {
        published.push(...events);
      },
    } as unknown as EventBus;
  });

  it('creates an open ticket attributed to the actor and publishes TicketCreated', async () => {
    const id = await new CreateTicketHandler(store, eventBus).execute(
      new CreateTicketCommand(
        { title: 'Broken keyboard', description: '', priority: 'high' },
        'user_a',
      ),
    );
    const ticket = await store.findById(id);
    expect(ticket).toMatchObject({ status: 'open', createdBy: 'user_a', updatedBy: 'user_a' });
    expect(published).toEqual([new TicketCreatedEvent(ticket!)]);
  });

  it('updates fields, records the editor and publishes update + status events', async () => {
    const id = await new CreateTicketHandler(store, eventBus).execute(
      new CreateTicketCommand({ title: 'A', description: '', priority: 'low' }, 'user_a'),
    );
    published.length = 0;

    await new UpdateTicketHandler(store, eventBus).execute(
      new UpdateTicketCommand(id, { status: 'resolved', title: 'A2' }, 'user_b'),
    );
    const ticket = await store.findById(id);
    expect(ticket).toMatchObject({
      status: 'resolved',
      title: 'A2',
      createdBy: 'user_a',
      updatedBy: 'user_b',
    });
    expect(published).toHaveLength(2);
    expect(published[0]).toBeInstanceOf(TicketUpdatedEvent);
    expect((published[0] as TicketUpdatedEvent).changedFields).toEqual(['status', 'title']);
    expect(published[1]).toEqual(new TicketStatusChangedEvent(ticket!, 'open', 'resolved'));
  });

  it('is a no-op when nothing changes', async () => {
    const id = await new CreateTicketHandler(store, eventBus).execute(
      new CreateTicketCommand({ title: 'A', description: '', priority: 'low' }, 'user_a'),
    );
    const before = await store.findById(id);
    published.length = 0;

    await new UpdateTicketHandler(store, eventBus).execute(
      new UpdateTicketCommand(id, { title: 'A' }, 'user_b'),
    );
    expect(await store.findById(id)).toEqual(before);
    expect(published).toEqual([]);
  });

  it('deletes and publishes TicketDeleted; unknown ids raise TicketNotFoundError', async () => {
    const id = await new CreateTicketHandler(store, eventBus).execute(
      new CreateTicketCommand({ title: 'A', description: '', priority: 'low' }, 'user_a'),
    );
    const handler = new DeleteTicketHandler(store, eventBus);
    await handler.execute(new DeleteTicketCommand(id, 'user_a'));
    expect(await store.findById(id)).toBeNull();
    expect(published.at(-1)).toEqual(new TicketDeletedEvent(id, 'user_a'));

    await expect(handler.execute(new DeleteTicketCommand(id, 'user_a'))).rejects.toBeInstanceOf(
      TicketNotFoundError,
    );
    await expect(
      new UpdateTicketHandler(store, eventBus).execute(new UpdateTicketCommand(id, {}, 'user_a')),
    ).rejects.toBeInstanceOf(TicketNotFoundError);
  });
});
