import type { DirectoryUser } from '@ticketmanager/contracts';

export const USER_DIRECTORY = Symbol('USER_DIRECTORY');

/** Read port over the identity provider's user store. */
export interface UserDirectory {
  findById(id: string): Promise<DirectoryUser | null>;
  /** Unknown ids are omitted; the result follows the order of `ids`. */
  findByIds(ids: readonly string[]): Promise<DirectoryUser[]>;
}
