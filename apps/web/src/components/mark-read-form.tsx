'use client';

import { useActionState } from 'react';
import type { ActionState } from '@/lib/action-state';
import { markNotificationReadAction } from '@/lib/notification-actions';
import { FormError } from './field-error';
import { SubmitButton } from './submit-button';

/** One-button form marking a notification as read; the error, if any, shows next to the button. */
export function MarkReadForm({ id }: { id: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    markNotificationReadAction.bind(null, id),
    {},
  );
  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <SubmitButton pendingLabel="…" className="text-sm underline">
        Mark as read
      </SubmitButton>
      <FormError message={state.error} />
    </form>
  );
}
