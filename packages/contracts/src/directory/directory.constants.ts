/** Maximum number of distinct user ids accepted by `GET /users?ids=`. */
export const DIRECTORY_BATCH_MAX_IDS = 50;

/**
 * Permission defined on the directory API resource in Logto and granted to machine-to-machine
 * callers through an M2M role. Requested in `client_credentials` token requests; not enforced
 * by the guard yet (user tokens issued to the web app carry no scope).
 */
export const DIRECTORY_READ_USERS_SCOPE = 'read:users';
