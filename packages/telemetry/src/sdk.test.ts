import { describe, expect, it } from 'vitest';
import { defaultServiceName, startTelemetry } from './sdk.js';

describe('startTelemetry', () => {
  it('stays off when disabled or unnamed', () => {
    expect(startTelemetry({ OTEL_SDK_DISABLED: 'true', OTEL_SERVICE_NAME: 'x' })).toBeUndefined();
    expect(startTelemetry({})).toBeUndefined();
  });
});

describe('defaultServiceName', () => {
  it('derives the name from the package and the entry file', () => {
    expect(
      defaultServiceName({ npm_package_name: '@ticketmanager/tickets-service' }, '/x/dist/main.js'),
    ).toBe('tickets-service');
    expect(
      defaultServiceName(
        { npm_package_name: '@ticketmanager/notifications-service' },
        '/x/dist/main.email-retry.js',
      ),
    ).toBe('notifications-service-email-retry');
    expect(defaultServiceName({}, '/x/dist/main.js')).toBeUndefined();
  });
});
