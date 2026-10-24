import { getLogtoContext } from '@logto/next/server-actions';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { NotificationList } from '@/components/notification-list';
import { getLogtoConfig } from '@/lib/logto';

export default function NotificationsPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Notifications</h1>
        <Link href="/" className="text-sm underline">
          Back to tickets
        </Link>
      </div>
      <Suspense fallback={<p className="text-zinc-500">Loading…</p>}>
        <Inbox />
      </Suspense>
    </main>
  );
}

async function Inbox() {
  await connection();
  const { isAuthenticated } = await getLogtoContext(getLogtoConfig());
  if (!isAuthenticated) redirect('/');
  return <NotificationList />;
}
