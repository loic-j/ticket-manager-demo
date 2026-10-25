import { Inject } from '@nestjs/common';
import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import type { DirectoryUsersResponse } from '@ticketmanager/contracts';
import { USER_DIRECTORY, type UserDirectory } from '../ports/index.js';
import { GetUsersQuery } from './get-users.query.js';

@QueryHandler(GetUsersQuery)
export class GetUsersHandler implements IQueryHandler<GetUsersQuery, DirectoryUsersResponse> {
  constructor(@Inject(USER_DIRECTORY) private readonly users: UserDirectory) {}

  async execute({ ids }: GetUsersQuery): Promise<DirectoryUsersResponse> {
    return { users: await this.users.findByIds(ids) };
  }
}
