'use server';

import { notificationIdSchema } from '@ticketmanager/contracts';
import { revalidatePath } from 'next/cache';
import { notificationsApi } from './api';

/** Bound to an id by the inbox: `markNotificationReadAction.bind(null, id)`. */
export async function markNotificationReadAction(id: string): Promise<void> {
  await notificationsApi.markRead(notificationIdSchema.parse(id));
  revalidatePath('/notifications');
  revalidatePath('/'); // unread badge
}
