import { describe, expect, it } from 'vitest';
import { StaticUserDirectory, user } from '../../infrastructure/testing.js';
import { GetUsersHandler } from './get-users.handler.js';
import { GetUsersQuery } from './get-users.query.js';

describe('GetUsersHandler', () => {
  const handler = new GetUsersHandler(
    new StaticUserDirectory([user('u1', 'Alice'), user('u2', 'Bob')]),
  );

  it('omits unknown ids and keeps the request order', async () => {
    expect(await handler.execute(new GetUsersQuery(['u2', 'missing', 'u1']))).toEqual({
      users: [user('u2', 'Bob'), user('u1', 'Alice')],
    });
  });

  it('returns an empty list when nothing matches', async () => {
    expect(await handler.execute(new GetUsersQuery(['x']))).toEqual({ users: [] });
  });
});
