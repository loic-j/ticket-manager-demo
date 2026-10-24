'use server';

import { createTicketSchema } from '@ticketmanager/shared';
import { revalidatePath } from 'next/cache';
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
