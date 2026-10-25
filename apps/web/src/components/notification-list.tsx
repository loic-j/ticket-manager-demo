import type { Notification } from '@ticketmanager/contracts';
import Link from 'next/link';
import { notificationsApi } from '@/lib/api';
import { ApiErrorMessage } from './api-error-message';
import { MarkReadForm } from './mark-read-form';

type Loaded = { ok: true; notifications: Notification[] } | { ok: false; error: unknown };

export async function NotificationList() {
  // Settle the call before rendering: the lint rules forbid JSX inside try/catch.
  const loaded: Loaded = await notificationsApi.list().then(
    (notifications) => ({ ok: true as const, notifications }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  if (!loaded.ok) return <ApiErrorMessage error={loaded.error} resource="notifications" />;
  const { notifications } = loaded;

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
            {!n.readAt && <MarkReadForm id={n.id} />}
          </div>
        </li>
      ))}
    </ul>
  );
}
