import type { IdTokenClaims } from '@logto/next/server-actions';
import { signOutAction } from '@/lib/auth-actions';

export function UserBar({ claims }: { claims?: IdTokenClaims }) {
  const label = claims?.email ?? claims?.name ?? claims?.sub ?? 'user';
  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-2 text-sm dark:border-zinc-800">
      <span>
        Signed in as <strong>{label}</strong>
      </span>
      <form action={signOutAction}>
        <button type="submit" className="underline">
          Sign out
        </button>
      </form>
    </div>
  );
}
