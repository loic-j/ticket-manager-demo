export const EMAIL_RETRY_POLICY = Symbol('EMAIL_RETRY_POLICY');

/** What the retry use case needs to know; bound from `NotificationsConfig` by the module. */
export interface EmailRetryPolicy {
  /** Give up on a notification after this many delivery attempts. */
  maxAttempts: number;
  /** A notification is retried only if its last attempt (or its creation) is older than this. */
  retryDelayMs: number;
}
