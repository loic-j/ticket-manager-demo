import { Logger } from '@nestjs/common';
import type { UserDirectory, UserProfile } from '../application/ports/user-directory.js';
import type { NotificationsConfig } from '../notifications.config.js';

/**
 * Development stand-in used when no M2M credentials are configured: every recipient gets
 * `NOTIFICATIONS_DEV_FALLBACK_EMAIL`, so the whole flow works before the M2M app exists in Logto.
 * The fallback address is ignored in production (`null` → "recipient has no email address").
 * Built by the `USER_DIRECTORY` factory in `NotificationsCoreModule`, not by Nest's injector.
 */
export class DevFallbackUserDirectory implements UserDirectory {
  private readonly logger = new Logger(DevFallbackUserDirectory.name);
  private warned = false;

  constructor(private readonly config: NotificationsConfig) {}

  async findById(userId: string): Promise<UserProfile | null> {
    if (!this.config.devFallbackEmail) return null;
    this.warnOnce(userId);
    return { email: this.config.devFallbackEmail, name: null };
  }

  private warnOnce(userId: string): void {
    if (this.warned) return;
    this.warned = true;
    this.logger.warn(
      `No LOGTO_M2M credentials: every email goes to ${this.config.devFallbackEmail} (first recipient: ${userId})`,
    );
  }
}
