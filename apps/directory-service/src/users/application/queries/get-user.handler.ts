import { Inject } from '@nestjs/common';
import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import type { DirectoryUser } from '@ticketmanager/contracts';
import { UserNotFoundError } from '../../domain/user-not-found.error.js';
import { USER_DIRECTORY, type UserDirectory } from '../ports/index.js';
import { GetUserQuery } from './get-user.query.js';

@QueryHandler(GetUserQuery)
export class GetUserHandler implements IQueryHandler<GetUserQuery, DirectoryUser> {
  constructor(@Inject(USER_DIRECTORY) private readonly users: UserDirectory) {}

  async execute({ id }: GetUserQuery): Promise<DirectoryUser> {
    const user = await this.users.findById(id);
    if (!user) throw new UserNotFoundError(id);
    return user;
  }
}
