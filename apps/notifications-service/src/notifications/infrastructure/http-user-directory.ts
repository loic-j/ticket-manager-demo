import { Inject, Injectable } from '@nestjs/common';
import {
  DIRECTORY_API_RESOURCE,
  DIRECTORY_READ_USERS_SCOPE,
  directoryUserSchema,
} from '@ticketmanager/contracts';
import { ServiceHttpClient, logtoClientCredentials } from '@ticketmanager/nest-common';
import type { UserDirectory, UserProfile } from '../application/ports/user-directory.js';
import { NOTIFICATIONS_CONFIG, type NotificationsConfig } from '../notifications.config.js';

/**
 * Resolves recipients through directory-service (`GET /users/:id`) with a machine-to-machine
 * token issued for the directory resource. Unknown user → `null`; any other failure throws so
 * `EmailDeliveryService` records the email as failed and `EmailRetryJob` tries again later.
 */
@Injectable()
export class HttpUserDirectory implements UserDirectory {
  private readonly http: ServiceHttpClient;

  constructor(@Inject(NOTIFICATIONS_CONFIG) config: NotificationsConfig) {
    if (!config.m2m)
      throw new Error('HttpUserDirectory needs LOGTO_M2M_APP_ID / LOGTO_M2M_APP_SECRET');
    this.http = new ServiceHttpClient({
      baseUrl: config.directoryApiUrl,
      tokens: logtoClientCredentials({
        endpoint: config.logtoEndpoint,
        appId: config.m2m.appId,
        appSecret: config.m2m.appSecret,
        resource: DIRECTORY_API_RESOURCE,
        scope: DIRECTORY_READ_USERS_SCOPE,
      }),
    });
  }

  async findById(userId: string): Promise<UserProfile | null> {
    const res = await this.http.request(`/users/${encodeURIComponent(userId)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Directory lookup failed: ${res.status}`);
    const user = directoryUserSchema.parse(await res.json());
    return { email: user.email, name: user.name };
  }
}
