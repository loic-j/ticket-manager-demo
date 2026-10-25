import { Controller, Get, Param, Query, UseFilters } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  directoryUserIdSchema,
  directoryUserIdsSchema,
  type DirectoryUser,
  type DirectoryUserIds,
  type DirectoryUsersResponse,
} from '@ticketmanager/contracts';
import { GetUserQuery, GetUsersQuery } from '../application/queries/index.js';
import { UserErrorsFilter } from './user-errors.filter.js';

/** Any token issued for the directory resource (user or machine) may read any profile. */
@Controller('users')
@UseFilters(UserErrorsFilter)
export class UsersController {
  constructor(private readonly queryBus: QueryBus) {}

  /** `GET /users?ids=a,b,c`: unknown ids are omitted. */
  @Get()
  list(
    @Query('ids', { schema: directoryUserIdsSchema }) ids: DirectoryUserIds,
  ): Promise<DirectoryUsersResponse> {
    return this.queryBus.execute<GetUsersQuery, DirectoryUsersResponse>(new GetUsersQuery(ids));
  }

  @Get(':id')
  get(@Param('id', { schema: directoryUserIdSchema }) id: string): Promise<DirectoryUser> {
    return this.queryBus.execute<GetUserQuery, DirectoryUser>(new GetUserQuery(id));
  }
}
