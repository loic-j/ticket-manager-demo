import Link from 'next/link';
import type { DirectoryUser, Ticket } from '@ticketmanager/contracts';
import { ApiError, directoryApi, ticketsApi } from '@/lib/api';
import { userLabel } from '@/lib/users';

export async function TicketList() {
  let tickets: Ticket[];
  try {
    tickets = await ticketsApi.list();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return <p className="text-red-600">The API rejected the access token (401).</p>;
    }
    return (
      <p className="text-red-600">
        Could not reach the API: {error instanceof Error ? error.message : String(error)}
      </p>
    );
  }

  if (tickets.length === 0) {
    return <p className="text-zinc-500">No tickets yet.</p>;
  }

  // One batched directory call for every creator; if the directory is down the raw ids show.
  const creators: DirectoryUser[] = await directoryApi
    .getUsers(tickets.map((t) => t.createdBy))
    .catch(() => []);
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
