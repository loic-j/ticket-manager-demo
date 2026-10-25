import { notFound } from 'next/navigation';
import type { ActionState } from './action-state';
import { ApiError } from './api';

export const SESSION_EXPIRED_MESSAGE = 'Your session expired, sign in again.';
export const CONFLICT_MESSAGE = 'This ticket was modified by someone else; reload and try again.';
export const GENERIC_FAILURE_MESSAGE = 'Something went wrong on our side. Try again in a moment.';

/**
 * Turns a failed API call into the state a form Server Action returns. The raw error is logged
 * here only: the user sees a wording per status, never the internal path or status line.
 * 404 means the resource the form works on is gone, so the action ends with `notFound()`.
 * Call it from the `catch` block; it never swallows Next.js control-flow errors because the
 * `try` must only wrap the API call (`redirect()` / `revalidatePath()` stay outside).
 */
export function failedActionState<Values>(error: unknown, values?: Values): ActionState<Values> {
  console.error('Server Action failed', error);
  if (error instanceof ApiError) {
    if (error.status === 401) return { error: SESSION_EXPIRED_MESSAGE, values };
    if (error.status === 404) notFound();
    if (error.status === 409) return { error: CONFLICT_MESSAGE, values };
  }
  return { error: GENERIC_FAILURE_MESSAGE, values };
}
