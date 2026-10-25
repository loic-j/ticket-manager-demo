import type { IdTokenClaims } from '@logto/next/server-actions';
import type { DirectoryUser } from '@ticketmanager/contracts';

/** Display label of a user: name, then email, then the raw Logto id when the directory is unavailable. */
export function userLabel(user: DirectoryUser | undefined, sub: string): string {
  return user?.name ?? user?.email ?? sub;
}

/** Display label of the signed-in user from the ID token claims; the Logto id is the last resort. */
export function claimsLabel(claims?: IdTokenClaims): string {
  return claims?.name ?? claims?.username ?? claims?.email ?? claims?.sub ?? 'user';
}
