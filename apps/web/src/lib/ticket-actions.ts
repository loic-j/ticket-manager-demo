'use server';

import {
  createTicketSchema,
  ticketIdSchema,
  updateTicketBodySchema,
} from '@ticketmanager/contracts';
import { revalidatePath } from 'next/cache';
import { notFound, redirect } from 'next/navigation';
import { failedActionState } from './action-errors';
import {
  fieldErrorsOf,
  type ActionState,
  type TicketFormState,
  type TicketFormValues,
} from './action-state';
import { ApiError, ticketsApi } from './api';

const STALE_FORM_MESSAGE = 'This form is out of date; reload the page and try again.';

const editPath = (id: string) => `/tickets/${id}/edit`;

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

/** `useActionState` signature: `(previousState, formData)`. */
export async function createTicketAction(
  _previous: TicketFormState,
  formData: FormData,
): Promise<TicketFormState> {
  const values: TicketFormValues = {
    title: text(formData, 'title'),
    description: text(formData, 'description'),
    priority: text(formData, 'priority') || 'medium',
  };
  // Same schema as the API: invalid input never leaves the server.
  const parsed = createTicketSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };

  try {
    await ticketsApi.create(parsed.data);
  } catch (error) {
    return failedActionState(error, values);
  }
  revalidatePath('/');
  return {};
}

/** Bound to a ticket id by the edit form: `updateTicketAction.bind(null, ticket.id)`. */
export async function updateTicketAction(
  id: string,
  _previous: TicketFormState,
  formData: FormData,
): Promise<TicketFormState> {
  const ticketId = ticketIdSchema.safeParse(id);
  if (!ticketId.success) notFound();

  const values: TicketFormValues = {
    title: text(formData, 'title'),
    description: text(formData, 'description'),
    status: text(formData, 'status'),
    priority: text(formData, 'priority'),
  };
  // The hidden `expectedVersion` input carries the version the form was rendered from, so a
  // concurrent edit is answered 409 by the API instead of being overwritten.
  const expectedVersion = text(formData, 'expectedVersion');
  const parsed = updateTicketBodySchema.safeParse({
    ...values,
    expectedVersion: expectedVersion === '' ? undefined : Number(expectedVersion),
  });
  if (!parsed.success) {
    const { expectedVersion: versionError, ...fieldErrors } = fieldErrorsOf(parsed.error);
    return { ...(versionError ? { error: STALE_FORM_MESSAGE } : {}), fieldErrors, values };
  }

  try {
    await ticketsApi.update(ticketId.data, parsed.data);
  } catch (error) {
    return failedActionState(error, values);
  }
  // redirect() throws, so it must stay outside the try block. The edit page is revalidated too:
  // the client cache would otherwise serve its previous render on the next visit.
  revalidatePath('/');
  revalidatePath(editPath(ticketId.data));
  redirect('/');
}

/**
 * Bound to a ticket id by the list: `deleteTicketAction.bind(null, id)`. The `useActionState`
 * arguments (previous state, form data) carry nothing this action needs, so they are not declared.
 */
export async function deleteTicketAction(id: string): Promise<ActionState> {
  const ticketId = ticketIdSchema.safeParse(id);
  if (!ticketId.success) notFound();

  try {
    await ticketsApi.remove(ticketId.data);
  } catch (error) {
    // Already deleted by someone else: the list was stale, refreshing it is the right outcome.
    if (!(error instanceof ApiError && error.status === 404)) return failedActionState(error);
  }
  revalidatePath('/');
  revalidatePath(editPath(ticketId.data));
  return {};
}
