import { z } from 'zod';
import { DIRECTORY_BATCH_MAX_IDS } from './directory.constants.js';

/** Logto user id (the `sub` claim). */
export const directoryUserIdSchema = z.string().trim().min(1).max(64);

/** A user profile as returned by the directory service. Unknown fields are `null`, never omitted. */
export const directoryUserSchema = z.object({
  id: directoryUserIdSchema,
  name: z.string().nullable(),
  email: z.email().nullable(),
  avatar: z.string().nullable(),
});
export type DirectoryUser = z.infer<typeof directoryUserSchema>;

/**
 * Turns the raw `ids` query parameter into a list: Express gives a string for `?ids=a,b` and an
 * array for `?ids=a&ids=b`. Values are split on commas, trimmed, emptied and deduplicated before
 * the size limit applies, so repeated ids never count twice.
 */
function splitCommaSeparated(raw: unknown): unknown {
  const parts = Array.isArray(raw) ? raw : [raw];
  const ids = parts
    .flatMap((part) => (typeof part === 'string' ? part.split(',') : [part]))
    .map((id) => (typeof id === 'string' ? id.trim() : id))
    .filter((id) => id !== '');
  return [...new Set(ids)];
}

/** `ids` query parameter of `GET /users`: 1 to `DIRECTORY_BATCH_MAX_IDS` distinct user ids. */
export const directoryUserIdsSchema = z.preprocess(
  splitCommaSeparated,
  z.array(directoryUserIdSchema).min(1).max(DIRECTORY_BATCH_MAX_IDS),
);
export type DirectoryUserIds = z.output<typeof directoryUserIdsSchema>;

/** Response of `GET /users?ids=`: unknown ids are omitted, order follows the request. */
export const directoryUsersResponseSchema = z.object({ users: z.array(directoryUserSchema) });
export type DirectoryUsersResponse = z.infer<typeof directoryUsersResponseSchema>;
