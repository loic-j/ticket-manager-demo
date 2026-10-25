import { z } from 'zod';

/**
 * Logto user id (the `sub` claim), as stored by every service (`createdBy`, `updatedBy`,
 * notification recipient, directory lookups). One definition so the bound is the same
 * everywhere: Logto ids are short, 128 leaves room for a different identity provider.
 */
export const userIdSchema = z.string().trim().min(1).max(128);
export type UserId = z.infer<typeof userIdSchema>;

/** The authenticated identity attached to each API request, derived from the access token. */
export const authUserSchema = z.object({
  /** Logto user id (`sub` claim). */
  sub: userIdSchema,
  email: z.email().optional(),
  name: z.string().optional(),
});
export type AuthUser = z.infer<typeof authUserSchema>;
