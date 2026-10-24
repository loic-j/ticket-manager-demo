import type { Ticket } from '@ticketmanager/shared';
import { ApiError, ticketsApi } from '@/lib/api';

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

  return (
    <ul className="flex flex-col gap-3">
      {tickets.map((ticket) => (
        <li key={ticket.id} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-medium">{ticket.title}</h2>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs uppercase dark:bg-zinc-800">
              {ticket.status} · {ticket.priority}
            </span>
          </div>
          {ticket.description && (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{ticket.description}</p>
          )}
        </li>
      ))}
    </ul>
  );
}
