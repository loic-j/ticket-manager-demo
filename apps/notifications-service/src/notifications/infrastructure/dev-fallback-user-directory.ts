import { Inject, Injectable, Logger } from '@nestjs/common';
import type { UserDirectory, UserProfile } from '../application/ports/user-directory.js';
import { NOTIFICATIONS_CONFIG, type NotificationsConfig } from '../notifications.config.js';

/**
 * Development stand-in used when no M2M credentials are configured: every recipient gets
 * `NOTIFICATIONS_DEV_FALLBACK_EMAIL`, so the whole flow works before the M2M app exists in Logto.
 * The fallback address is ignored in production (`null` → "recipient has no email address").
 */
@Injectable()
export class DevFallbackUserDirectory implements UserDirectory {
  private readonly logger = new Logger(DevFallbackUserDirectory.name);

  constructor(@Inject(NOTIFICATIONS_CONFIG) private readonly config: NotificationsConfig) {}

  async findById(userId: string): Promise<UserProfile | null> {
    if (!this.config.devFallbackEmail) return null;
    this.logger.warn(`No LOGTO_M2M credentials: using fallback email for user ${userId}`);
    return { email: this.config.devFallbackEmail, name: null };
  }
}
