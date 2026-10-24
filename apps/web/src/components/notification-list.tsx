import type { Notification } from '@ticketmanager/contracts';
import Link from 'next/link';
import { ApiError, notificationsApi } from '@/lib/api';
import { markNotificationReadAction } from '@/lib/notification-actions';
import { SubmitButton } from './submit-button';

export async function NotificationList() {
  let notifications: Notification[];
  try {
    notifications = await notificationsApi.list();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return (
        <p className="text-red-600">
          The notifications API rejected the access token (401). Sign out and in again so a token
          for the notifications resource is issued.
        </p>
      );
    }
    return (
      <p className="text-red-600">
        Could not reach the notifications API:{' '}
        {error instanceof Error ? error.message : String(error)}
      </p>
    );
  }

  if (notifications.length === 0) {
    return <p className="text-zinc-500">No notifications yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {notifications.map((n) => (
        <li
          key={n.id}
          className={`rounded-lg border p-4 ${
            n.readAt
              ? 'border-zinc-200 text-zinc-500 dark:border-zinc-800'
              : 'border-zinc-400 dark:border-zinc-500'
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-medium">{n.title}</h2>
              <p className="mt-1 text-sm">{n.body}</p>
              <p className="mt-2 text-xs text-zinc-500">
                {new Date(n.createdAt).toLocaleString('en-GB')} · email {n.email} ·{' '}
                <Link href={`/tickets/${n.ticketId}/edit`} className="underline">
                  open ticket
                </Link>
              </p>
            </div>
            {!n.readAt && (
              <form action={markNotificationReadAction.bind(null, n.id)}>
                <SubmitButton pendingLabel="…" className="text-sm underline">
                  Mark as read
                </SubmitButton>
              </form>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
