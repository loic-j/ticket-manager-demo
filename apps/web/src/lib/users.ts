import type { DirectoryUser } from '@ticketmanager/contracts';

/** Display label of a user: name, then email, then the raw Logto id when the directory is unavailable. */
export function userLabel(user: DirectoryUser | undefined, sub: string): string {
  return user?.name ?? user?.email ?? sub;
}
