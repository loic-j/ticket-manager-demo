import { Counter, Rate, Trend } from 'k6/metrics';

/** Unexpected HTTP statuses on the application APIs (the token call is excluded). */
export const apiErrors = new Rate('api_errors');
/** Time from `POST /tickets` to the matching notification being listed by notifications-service. */
export const notificationE2eMs = new Trend('notification_e2e_ms', true);
/** Notifications still absent after the polling deadline. */
export const notificationsMissing = new Counter('notifications_missing');
