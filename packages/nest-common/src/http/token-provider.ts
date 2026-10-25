/** Supplies the bearer token an outgoing service-to-service request must carry. */
export interface TokenProvider {
  getToken(): Promise<string>;
  /** Drops the cached token (after a 401) so the next `getToken()` fetches a fresh one. */
  invalidate(): void;
}
