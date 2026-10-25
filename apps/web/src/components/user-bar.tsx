import type { IdTokenClaims } from '@logto/next/server-actions';
import { Suspense } from 'react';
import { signOutAction } from '@/lib/auth-actions';
import { claimsLabel } from '@/lib/users';
import { NotificationsBadge } from './notifications-badge';
import { SubmitButton } from './submit-button';

export function UserBar({ claims }: { claims?: IdTokenClaims }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-2 text-sm dark:border-zinc-800">
      <span>
        Signed in as <strong>{claimsLabel(claims)}</strong>
      </span>
      <div className="flex items-center gap-4">
        <Suspense fallback={<span className="text-zinc-500">Notifications</span>}>
          <NotificationsBadge />
        </Suspense>
        <form action={signOutAction}>
          <SubmitButton pendingLabel="Signing out…" className="underline">
            Sign out
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
