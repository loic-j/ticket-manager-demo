import type { DirectoryUser, Ticket } from '@ticketmanager/contracts';
import Link from 'next/link';
import { directoryApi, ticketsApi } from '@/lib/api';
import { userLabel } from '@/lib/users';
import { ApiErrorMessage } from './api-error-message';
import { DeleteTicketForm } from './delete-ticket-form';

type Loaded = { ok: true; tickets: Ticket[] } | { ok: false; error: unknown };

export async function TicketList() {
  // Settle the call before rendering: the lint rules forbid JSX inside try/catch.
  const loaded: Loaded = await ticketsApi.list().then(
    (tickets) => ({ ok: true as const, tickets }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  if (!loaded.ok) return <ApiErrorMessage error={loaded.error} resource="tickets" />;
  const { tickets } = loaded;

  if (tickets.length === 0) {
    return <p className="text-zinc-500">No tickets yet.</p>;
  }

  // One batched directory call for every creator; if the directory is down the raw ids show.
  const creators: DirectoryUser[] = await directoryApi
    .getUsers(tickets.map((t) => t.createdBy))
    .catch((error: unknown) => {
      console.error('Directory lookup failed, showing raw user ids instead', error);
      return [];
    });
  const byId = new Map(creators.map((u) => [u.id, u]));

  return (
    <ul className="flex flex-col gap-3">
      {tickets.map((ticket) => (
        <li key={ticket.id} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-medium">{ticket.title}</h2>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs uppercase dark:bg-zinc-800">
                {ticket.status} · {ticket.priority}
              </span>
              <Link href={`/tickets/${ticket.id}/edit`} className="text-sm underline">
                Edit
              </Link>
              <DeleteTicketForm id={ticket.id} />
            </div>
          </div>
          {ticket.description && (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{ticket.description}</p>
          )}
          <p className="mt-2 text-xs text-zinc-500">
            Created by {userLabel(byId.get(ticket.createdBy), ticket.createdBy)}
          </p>
        </li>
      ))}
    </ul>
  );
}
