import { signInAction } from '@/lib/auth-actions';

export function SignedOut({ error }: { error?: string }) {
  return (
    <div className="flex flex-col items-start gap-4">
      {error === 'sign-in' && <p className="text-red-600">Sign-in failed. Please try again.</p>}
      <p className="text-zinc-600 dark:text-zinc-400">Sign in to see the tickets.</p>
      <form action={signInAction}>
        <button
          type="submit"
          className="rounded-full bg-foreground px-5 py-2 text-background transition-colors hover:opacity-80"
        >
          Sign in
        </button>
      </form>
    </div>
  );
}
