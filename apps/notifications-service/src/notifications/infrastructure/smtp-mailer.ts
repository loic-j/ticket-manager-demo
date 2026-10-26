import { Inject, Injectable } from '@nestjs/common';
import { ATTR, count, notificationMetrics } from '@ticketmanager/telemetry';
import nodemailer, { type Transporter } from 'nodemailer';
import { NOTIFICATIONS_CONFIG, type NotificationsConfig } from '../notifications.config.js';
import type { Mail, Mailer } from '../application/ports/mailer.js';

/** Sends through SMTP (Mailpit locally). */
@Injectable()
export class SmtpMailer implements Mailer {
  private readonly transporter: Transporter;

  constructor(@Inject(NOTIFICATIONS_CONFIG) private readonly config: NotificationsConfig) {
    this.transporter = nodemailer.createTransport(config.smtpUrl);
  }

  async send(mail: Mail): Promise<void> {
    try {
      await this.transporter.sendMail({ from: this.config.mailFrom, ...mail });
      count(notificationMetrics.emails, { [ATTR.outcome]: 'sent' });
    } catch (error) {
      count(notificationMetrics.emails, { [ATTR.outcome]: 'failed' });
      throw error;
    }
  }
}
