'use client';

import { TICKET_PRIORITIES, TICKET_STATUSES, type Ticket } from '@ticketmanager/contracts';
import Link from 'next/link';
import { useActionState } from 'react';
import type { TicketFormState } from '@/lib/action-state';
import { updateTicketAction } from '@/lib/ticket-actions';
import { FieldError, FormError } from './field-error';
import { SubmitButton } from './submit-button';

const fieldClass = 'rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900';

export function EditTicketForm({ ticket }: { ticket: Ticket }) {
  const [state, formAction] = useActionState<TicketFormState, FormData>(
    updateTicketAction.bind(null, ticket.id),
    {},
  );
  // After an error the form keeps what the user typed instead of reverting to the stored ticket.
  const values = state.values ?? ticket;

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
    >
      {/* Version the form was rendered from: the API answers 409 if the ticket changed since. */}
      <input type="hidden" name="expectedVersion" value={ticket.version} />
      <FormError message={state.error} />
      <label className="flex flex-col gap-1 text-sm">
        Title
        <input
          name="title"
          required
          maxLength={200}
          defaultValue={values.title}
          className={fieldClass}
        />
        <FieldError message={state.fieldErrors?.title} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Description
        <textarea
          name="description"
          maxLength={5000}
          rows={4}
          defaultValue={values.description}
          className={fieldClass}
        />
        <FieldError message={state.fieldErrors?.description} />
      </label>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Status
          <select name="status" defaultValue={values.status} className={fieldClass}>
            {TICKET_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <FieldError message={state.fieldErrors?.status} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Priority
          <select name="priority" defaultValue={values.priority} className={fieldClass}>
            {TICKET_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <FieldError message={state.fieldErrors?.priority} />
        </label>
        <SubmitButton
          pendingLabel="Saving…"
          className="rounded-full bg-foreground px-5 py-2 text-background transition-colors hover:opacity-80 disabled:opacity-50"
        >
          Save
        </SubmitButton>
        <Link href="/" className="px-2 py-2 text-sm underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}
