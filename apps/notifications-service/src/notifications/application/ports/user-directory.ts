export const USER_DIRECTORY = Symbol('USER_DIRECTORY');

export interface UserProfile {
  email: string | null;
  name: string | null;
}

/** Looks up users in the identity provider (Logto). */
export interface UserDirectory {
  findById(userId: string): Promise<UserProfile | null>;
}
