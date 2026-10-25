import { Module } from '@nestjs/common';
import { NotificationsCoreModule } from './notifications-core.module.js';
import { EmailRetryJob } from './presentation/email-retry.job.js';

/** Email retry worker: only the email-retry process imports this module. */
@Module({
  imports: [NotificationsCoreModule],
  providers: [EmailRetryJob],
})
export class EmailRetryModule {}
