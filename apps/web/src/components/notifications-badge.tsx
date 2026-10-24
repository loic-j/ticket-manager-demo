import Link from 'next/link';
import { connection } from 'next/server';
import { notificationsApi } from '@/lib/api';

/**
 * Unread counter linking to the inbox. Reads per-request data, so it must sit inside its own
 * <Suspense> and call `connection()` itself. Any API failure hides the counter, never the page.
 */
export async function NotificationsBadge() {
  await connection();
  let unread: number | null = null;
  try {
    unread = (await notificationsApi.list()).filter((n) => n.readAt === null).length;
  } catch {
    unread = null;
  }
  return (
    <Link href="/notifications" className="flex items-center gap-2 underline">
      Notifications
      {unread !== null && unread > 0 && (
        <span className="rounded-full bg-foreground px-2 py-0.5 text-xs text-background">
          {unread}
        </span>
      )}
    </Link>
  );
}
