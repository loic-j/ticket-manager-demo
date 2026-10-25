import { ApiError } from '@/lib/api';

/**
 * What a page shows when a read from one of the services failed. The raw error (with the
 * internal URL and status) goes to the server log only; the user gets a wording per cause.
 */
export function ApiErrorMessage({ error, resource }: { error: unknown; resource: string }) {
  console.error(`Could not load the ${resource}`, error);
  const message =
    error instanceof ApiError && error.status === 401
      ? `Your session no longer grants access to the ${resource}. Sign out and in again.`
      : `The ${resource} are unavailable right now. Try again in a moment.`;
  return (
    <p role="alert" className="text-red-600">
      {message}
    </p>
  );
}
