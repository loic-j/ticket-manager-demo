/** Raised by the email retry worker on every tick: re-send the emails still due. */
export class RetryPendingEmailsCommand {
  constructor(readonly now: Date = new Date()) {}
}
