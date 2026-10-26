import { z } from 'zod';

export const NOTIFICATION_KINDS = [
  'ticket_created',
  'ticket_updated',
  'ticket_status_changed',
  'ticket_deleted',
] as const;
export const notificationKindSchema = z.enum(NOTIFICATION_KINDS);
export type NotificationKind = z.infer<typeof notificationKindSchema>;

export const NOTIFICATION_DELIVERY_STATUSES = ['pending', 'sent', 'failed'] as const;
export const deliveryStatusSchema = z.enum(NOTIFICATION_DELIVERY_STATUSES);
export type DeliveryStatus = z.infer<typeof deliveryStatusSchema>;

export const notificationIdSchema = z.uuid();

/** A notification as returned by `GET /notifications`. */
export const notificationSchema = z.object({
  id: notificationIdSchema,
  kind: notificationKindSchema,
  title: z.string().min(1).max(200),
  body: z.string(),
  ticketId: z.uuid(),
  readAt: z.iso.datetime().nullable(),
  email: deliveryStatusSchema,
  createdAt: z.iso.datetime(),
});
export type Notification = z.infer<typeof notificationSchema>;
