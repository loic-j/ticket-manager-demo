import { TICKET_PRIORITIES } from '@ticketmanager/shared';
import { createTicketAction } from '@/lib/ticket-actions';

export function NewTicketForm() {
  return (
    <form
      action={createTicketAction}
      className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <h2 className="font-medium">New ticket</h2>
      <input
        name="title"
        required
        maxLength={200}
        placeholder="Title"
        className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
      />
      <textarea
        name="description"
        maxLength={5000}
        placeholder="Description (optional)"
        className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
      />
      <div className="flex items-center gap-3">
        <select
          name="priority"
          defaultValue="medium"
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        >
          {TICKET_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-full bg-foreground px-5 py-2 text-background transition-colors hover:opacity-80"
        >
          Create
        </button>
      </div>
    </form>
  );
}
