import { loadNotificationsConfig, MIN_EMAIL_RETRY_DELAY_MS } from './notifications.config.js';

describe('loadNotificationsConfig', () => {
  it('reads through a ConfigService-like source and applies defaults', () => {
    const values: Record<string, string> = { EMAIL_MAX_ATTEMPTS: '3' };
    const configService = { get: <T = string>(key: string) => values[key] as T | undefined };
    const config = loadNotificationsConfig(configService);
    expect(config).toMatchObject({ emailMaxAttempts: 3, emailRetryDelayMs: 60_000, m2m: null });
  });

  it('requires M2M credentials in production', () => {
    expect(() => loadNotificationsConfig({ NODE_ENV: 'production' })).toThrow(/LOGTO_M2M_APP_ID/);
    expect(
      loadNotificationsConfig({
        NODE_ENV: 'production',
        LOGTO_M2M_APP_ID: 'app',
        LOGTO_M2M_APP_SECRET: 's',
      }).m2m,
    ).toEqual({ appId: 'app', appSecret: 's' });
  });

  it('refuses a retry delay shorter than a first delivery attempt', () => {
    expect(() =>
      loadNotificationsConfig({ EMAIL_RETRY_DELAY_MS: String(MIN_EMAIL_RETRY_DELAY_MS - 1) }),
    ).toThrow(/EMAIL_RETRY_DELAY_MS/);
    expect(
      loadNotificationsConfig({ EMAIL_RETRY_DELAY_MS: String(MIN_EMAIL_RETRY_DELAY_MS) })
        .emailRetryDelayMs,
    ).toBe(MIN_EMAIL_RETRY_DELAY_MS);
  });
});
