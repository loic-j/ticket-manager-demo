'use client'; // Error boundaries must be Client Components

import Link from 'next/link';
import { useEffect } from 'react';

/**
 * Safety net for whatever the pages did not handle themselves (a Server Component throwing, a
 * Server Action failing outside its try). In production Next.js forwards a generic message plus
 * `digest` to match the server log, never the original error.
 */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        The page could not be displayed. You can try again or go back to the tickets.
      </p>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-full bg-foreground px-5 py-2 text-background transition-colors hover:opacity-80"
        >
          Try again
        </button>
        <Link href="/" className="text-sm underline">
          Back to tickets
        </Link>
      </div>
    </main>
  );
}
