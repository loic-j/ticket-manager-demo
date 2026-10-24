/**
 * Identifier of the API resource registered in Logto (Console → API resources).
 * Access tokens issued for the API carry it in the `aud` claim. It must be a URI;
 * it is never fetched.
 */
export const API_RESOURCE_INDICATOR = 'https://api.ticketmanager.local';
