import { Suspense } from 'react';
import { TicketList } from '@/components/ticket-list';

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Tickets</h1>
      <Suspense fallback={<p className="text-zinc-500">Loading tickets…</p>}>
        <TicketList />
      </Suspense>
    </main>
  );
}
