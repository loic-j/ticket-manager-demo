/** Base URLs per target (see infra/compose/load.yml) and the Logto resources of the services. */
const TARGETS = {
  host: {
    tickets: 'http://host.docker.internal:3001',
    notifications: 'http://host.docker.internal:3002',
    web: 'http://host.docker.internal:3000',
  },
  docker: {
    tickets: 'http://tickets-service:3001',
    notifications: 'http://notifications-service:3002',
    web: 'http://web:3000',
  },
} as const;

type Target = keyof typeof TARGETS;

const target = (__ENV.TARGET ?? 'host') as Target;
if (!(target in TARGETS)) throw new Error(`TARGET must be host or docker, got "${target}"`);

export const config = {
  target,
  urls: TARGETS[target],
  logtoEndpoint: (__ENV.LOGTO_ENDPOINT ?? 'http://logto:3301').replace(/\/$/, ''),
  appId: __ENV.LOADTEST_APP_ID ?? '',
  appSecret: __ENV.LOADTEST_APP_SECRET ?? '',
  resources: {
    tickets: 'https://api.ticketmanager.local',
    notifications: 'https://notifications.ticketmanager.local',
  },
  /** Permission the load-tester role holds on both resources. */
  scope: 'load:test',
};

export function requireCredentials(): void {
  if (!config.appId || !config.appSecret) {
    throw new Error(
      'LOADTEST_APP_ID / LOADTEST_APP_SECRET are not set: copy tools/load/.env.example to tools/load/.env',
    );
  }
}
