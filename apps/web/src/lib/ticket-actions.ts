'use server';

import { createTicketSchema, ticketIdSchema, updateTicketSchema } from '@ticketmanager/contracts';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ticketsApi } from './api';

export async function createTicketAction(formData: FormData) {
  // Same schema as the API: invalid input never leaves the server.
  const input = createTicketSchema.parse({
    title: formData.get('title'),
    description: formData.get('description') ?? '',
    priority: formData.get('priority') ?? 'medium',
  });
  await ticketsApi.create(input);
  revalidatePath('/');
}

/** Bound to a ticket id by the edit form: `updateTicketAction.bind(null, ticket.id)`. */
export async function updateTicketAction(id: string, formData: FormData) {
  const ticketId = ticketIdSchema.parse(id);
  const input = updateTicketSchema.parse({
    title: formData.get('title'),
    description: formData.get('description') ?? '',
    status: formData.get('status'),
    priority: formData.get('priority'),
  });
  await ticketsApi.update(ticketId, input);
  revalidatePath('/');
  redirect('/');
}
