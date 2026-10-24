import Link from 'next/link';
import { TICKET_PRIORITIES, TICKET_STATUSES, type Ticket } from '@ticketmanager/contracts';
import { updateTicketAction } from '@/lib/ticket-actions';

const fieldClass = 'rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900';

export function EditTicketForm({ ticket }: { ticket: Ticket }) {
  return (
    <form
      action={updateTicketAction.bind(null, ticket.id)}
      className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <label className="flex flex-col gap-1 text-sm">
        Title
        <input
          name="title"
          required
          maxLength={200}
          defaultValue={ticket.title}
          className={fieldClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Description
        <textarea
          name="description"
          maxLength={5000}
          rows={4}
          defaultValue={ticket.description}
          className={fieldClass}
        />
      </label>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Status
          <select name="status" defaultValue={ticket.status} className={fieldClass}>
            {TICKET_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Priority
          <select name="priority" defaultValue={ticket.priority} className={fieldClass}>
            {TICKET_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-full bg-foreground px-5 py-2 text-background transition-colors hover:opacity-80"
        >
          Save
        </button>
        <Link href="/" className="px-2 py-2 text-sm underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}
