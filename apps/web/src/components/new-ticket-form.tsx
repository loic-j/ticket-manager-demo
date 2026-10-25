'use client';

import { TICKET_PRIORITIES } from '@ticketmanager/contracts';
import { useActionState } from 'react';
import type { TicketFormState } from '@/lib/action-state';
import { createTicketAction } from '@/lib/ticket-actions';
import { FieldError, FormError } from './field-error';
import { SubmitButton } from './submit-button';

const fieldClass = 'rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900';

export function NewTicketForm() {
  const [state, formAction] = useActionState<TicketFormState, FormData>(createTicketAction, {});
  // After an error the form is re-rendered with what the user typed; after a success it is reset.
  const values = state.values;

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <h2 className="font-medium">New ticket</h2>
      <FormError message={state.error} />
      <label className="flex flex-col gap-1 text-sm">
        <input
          name="title"
          required
          maxLength={200}
          placeholder="Title"
          aria-label="Title"
          defaultValue={values?.title}
          className={fieldClass}
        />
        <FieldError message={state.fieldErrors?.title} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <textarea
          name="description"
          maxLength={5000}
          placeholder="Description (optional)"
          aria-label="Description"
          defaultValue={values?.description}
          className={fieldClass}
        />
        <FieldError message={state.fieldErrors?.description} />
      </label>
      <div className="flex items-center gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <select
            name="priority"
            aria-label="Priority"
            defaultValue={values?.priority ?? 'medium'}
            className={fieldClass}
          >
            {TICKET_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <FieldError message={state.fieldErrors?.priority} />
        </label>
        <SubmitButton
          pendingLabel="Creating…"
          className="rounded-full bg-foreground px-5 py-2 text-background transition-colors hover:opacity-80 disabled:opacity-50"
        >
          Create
        </SubmitButton>
      </div>
    </form>
  );
}
