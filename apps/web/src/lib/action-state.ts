import { z } from 'zod';

/**
 * State returned by the form Server Actions and consumed by `useActionState`.
 * An empty object means "nothing to report" (initial render, or a success that did not redirect).
 */
export interface ActionState<Values = undefined> {
  /** Form-level message: API failure, expired session, concurrent modification. */
  error?: string;
  /** One validation message per form field, keyed by the input `name`. */
  fieldErrors?: Record<string, string>;
  /** What the user submitted, so the form re-renders with it after an error. */
  values?: Values;
}

/** Raw text of the ticket form fields, before validation. */
export interface TicketFormValues {
  title: string;
  description: string;
  priority: string;
  /** Only the edit form has a status field. */
  status?: string;
}

export type TicketFormState = ActionState<TicketFormValues>;

/** First message per field of a Zod error, in the shape `ActionState.fieldErrors` expects. */
export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const flat = z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
  return Object.fromEntries(
    Object.entries(flat).flatMap(([field, messages]) =>
      messages?.[0] ? [[field, messages[0]]] : [],
    ),
  );
}
