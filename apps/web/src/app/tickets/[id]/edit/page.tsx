import { getLogtoContext } from '@logto/next/server-actions';
import { ticketIdSchema } from '@ticketmanager/contracts';
import { notFound, redirect } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { EditTicketForm } from '@/components/edit-ticket-form';
import { ApiError, ticketsApi } from '@/lib/api';
import { getLogtoConfig } from '@/lib/logto';

export default function EditTicketPage({ params }: PageProps<'/tickets/[id]/edit'>) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Edit ticket</h1>
      <Suspense fallback={<p className="text-zinc-500">Loading…</p>}>
        <EditTicket params={params} />
      </Suspense>
    </main>
  );
}

async function EditTicket({ params }: Pick<PageProps<'/tickets/[id]/edit'>, 'params'>) {
  await connection();
  const { isAuthenticated } = await getLogtoContext(getLogtoConfig());
  if (!isAuthenticated) redirect('/');

  const { id } = await params;
  if (!ticketIdSchema.safeParse(id).success) notFound();

  const ticket = await ticketsApi.get(id).catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  });
  return <EditTicketForm ticket={ticket} />;
}
