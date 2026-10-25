import Link from 'next/link';

/** Rendered when a page or a Server Action calls `notFound()` (unknown or deleted ticket). */
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Not found</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        This ticket does not exist or has been deleted.
      </p>
      <Link href="/" className="text-sm underline">
        Back to tickets
      </Link>
    </main>
  );
}
