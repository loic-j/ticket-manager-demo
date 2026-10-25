'use server';

import { notificationIdSchema } from '@ticketmanager/contracts';
import { revalidatePath } from 'next/cache';
import { notFound } from 'next/navigation';
import { failedActionState } from './action-errors';
import type { ActionState } from './action-state';
import { notificationsApi } from './api';

/**
 * Bound to an id by the inbox: `markNotificationReadAction.bind(null, id)`. The `useActionState`
 * arguments (previous state, form data) carry nothing this action needs, so they are not declared.
 */
export async function markNotificationReadAction(id: string): Promise<ActionState> {
  const notificationId = notificationIdSchema.safeParse(id);
  if (!notificationId.success) notFound();

  try {
    await notificationsApi.markRead(notificationId.data);
  } catch (error) {
    return failedActionState(error);
  }
  revalidatePath('/notifications');
  revalidatePath('/'); // unread badge
  return {};
}
