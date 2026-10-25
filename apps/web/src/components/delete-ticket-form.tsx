'use client';

import { useActionState } from 'react';
import type { ActionState } from '@/lib/action-state';
import { deleteTicketAction } from '@/lib/ticket-actions';
import { FormError } from './field-error';
import { SubmitButton } from './submit-button';

/** One-button form deleting a ticket from the list; the error, if any, shows next to the button. */
export function DeleteTicketForm({ id }: { id: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    deleteTicketAction.bind(null, id),
    {},
  );
  return (
    <form action={formAction} className="flex items-center gap-2">
      <SubmitButton pendingLabel="Deleting…" className="text-sm text-red-600 underline">
        Delete
      </SubmitButton>
      <FormError message={state.error} />
    </form>
  );
}
