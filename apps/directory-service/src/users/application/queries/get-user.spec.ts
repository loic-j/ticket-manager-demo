import { describe, expect, it } from 'vitest';
import { UserNotFoundError } from '../../domain/user-not-found.error.js';
import { StaticUserDirectory, user } from '../../infrastructure/testing.js';
import { GetUserHandler } from './get-user.handler.js';
import { GetUserQuery } from './get-user.query.js';

describe('GetUserHandler', () => {
  const handler = new GetUserHandler(new StaticUserDirectory([user('u1', 'Alice')]));

  it('returns the profile view', async () => {
    expect(await handler.execute(new GetUserQuery('u1'))).toEqual(user('u1', 'Alice'));
  });

  it('throws UserNotFoundError for an unknown id', async () => {
    await expect(handler.execute(new GetUserQuery('nope'))).rejects.toBeInstanceOf(
      UserNotFoundError,
    );
  });
});
