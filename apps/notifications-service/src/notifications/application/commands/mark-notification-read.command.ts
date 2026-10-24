export class MarkNotificationReadCommand {
  constructor(
    readonly notificationId: string,
    /** Logto `sub` of the caller: a user can only read their own notifications. */
    readonly userId: string,
  ) {}
}
