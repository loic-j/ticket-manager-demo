/**
 * Identifiers of the API resources registered in Logto (Console → API resources).
 * Access tokens issued for a service carry its indicator in the `aud` claim. They must be URIs
 * and are never fetched.
 */
export const TICKETS_API_RESOURCE = 'https://api.ticketmanager.local';
export const NOTIFICATIONS_API_RESOURCE = 'https://notifications.ticketmanager.local';
export const DIRECTORY_API_RESOURCE = 'https://directory.ticketmanager.local';
