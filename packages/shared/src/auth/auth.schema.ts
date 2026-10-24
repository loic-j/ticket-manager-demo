import { z } from 'zod';

/** The authenticated identity attached to each API request, derived from the access token. */
export const authUserSchema = z.object({
  /** Logto user id (`sub` claim). */
  sub: z.string().min(1),
  email: z.email().optional(),
  name: z.string().optional(),
});
export type AuthUser = z.infer<typeof authUserSchema>;
