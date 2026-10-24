import { Module } from '@nestjs/common';
import { EmailRetryJob } from './infrastructure/email-retry.job.js';
import { NotificationsCoreModule } from './notifications-core.module.js';

/** Email retry worker: only the email-retry process imports this module. */
@Module({
  imports: [NotificationsCoreModule],
  providers: [EmailRetryJob],
})
export class EmailRetryModule {}
