import { getLogtoContext } from '@logto/next/server-actions';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { NewTicketForm } from '@/components/new-ticket-form';
import { SignedOut } from '@/components/signed-out';
import { TicketList } from '@/components/ticket-list';
import { UserBar } from '@/components/user-bar';
import { getLogtoConfig } from '@/lib/logto';

export default function Home({ searchParams }: PageProps<'/'>) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Tickets</h1>
      {/* Reads the session cookie, so it is dynamic and must sit inside a Suspense boundary. */}
      <Suspense fallback={<p className="text-zinc-500">Loading…</p>}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Dashboard({ searchParams }: Pick<PageProps<'/'>, 'searchParams'>) {
  // Opt out of prerendering before touching env/cookies: this UI depends on the live session.
  await connection();
  const { isAuthenticated, claims } = await getLogtoContext(getLogtoConfig());

  if (!isAuthenticated) {
    const { error } = await searchParams;
    return <SignedOut error={typeof error === 'string' ? error : undefined} />;
  }

  return (
    <>
      <UserBar claims={claims} />
      <NewTicketForm />
      <TicketList />
    </>
  );
}
