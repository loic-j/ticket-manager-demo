export const PROCESSED_EVENTS = Symbol('PROCESSED_EVENTS');

/**
 * Inbox for at-least-once delivery. `claim` must run inside the unit of work that applies the
 * event's side effects, so a duplicate is detected by the primary key when the row commits.
 */
export interface ProcessedEvents {
  /** @returns `false` when the event id was already recorded (duplicate delivery). */
  claim(eventId: string, type: string): Promise<boolean>;
}
