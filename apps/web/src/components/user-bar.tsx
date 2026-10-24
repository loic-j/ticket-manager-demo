import type { IdTokenClaims } from '@logto/next/server-actions';
import { signOutAction } from '@/lib/auth-actions';

/** Human-readable label for the signed-in user; the Logto id is the last resort. */
export function userLabel(claims?: IdTokenClaims): string {
  return claims?.name ?? claims?.username ?? claims?.email ?? claims?.sub ?? 'user';
}

export function UserBar({ claims }: { claims?: IdTokenClaims }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-2 text-sm dark:border-zinc-800">
      <span>
        Signed in as <strong>{userLabel(claims)}</strong>
      </span>
      <form action={signOutAction}>
        <button type="submit" className="underline">
          Sign out
        </button>
      </form>
    </div>
  );
}
