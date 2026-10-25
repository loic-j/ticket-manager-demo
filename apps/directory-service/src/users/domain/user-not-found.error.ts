export class UserNotFoundError extends Error {
  constructor(readonly userId: string) {
    super(`User ${userId} not found`);
    this.name = 'UserNotFoundError';
  }
}
