import type { DirectoryUser } from '@ticketmanager/contracts';
import type { UserDirectory } from '../application/ports/user-directory.js';

export function user(id: string, name: string | null = null): DirectoryUser {
  return { id, name, email: `${id}@example.com`, avatar: null };
}

/** Fixed set of users; counts lookups so caching specs can assert on them. */
export class StaticUserDirectory implements UserDirectory {
  readonly lookups: string[][] = [];
  failWith?: Error;
  private readonly users: Map<string, DirectoryUser>;

  constructor(users: DirectoryUser[] = []) {
    this.users = new Map(users.map((u) => [u.id, u]));
  }

  async findById(id: string): Promise<DirectoryUser | null> {
    return (await this.findByIds([id]))[0] ?? null;
  }

  async findByIds(ids: readonly string[]): Promise<DirectoryUser[]> {
    if (this.failWith) throw this.failWith;
    this.lookups.push([...ids]);
    return ids.flatMap((id) => {
      const found = this.users.get(id);
      return found ? [found] : [];
    });
  }
}
