import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseFilters,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  createTicketSchema,
  ticketIdSchema,
  updateTicketSchema,
  type AuthUser,
  type CreateTicketDto,
  type Ticket,
  type UpdateTicketDto,
} from '@ticketmanager/contracts';
import { CurrentUser } from '@ticketmanager/nest-common';
import {
  CreateTicketCommand,
  DeleteTicketCommand,
  UpdateTicketCommand,
} from '../application/commands/index.js';
import { GetTicketQuery, ListTicketsQuery } from '../application/queries/index.js';
import { TicketErrorsFilter } from './ticket-errors.filter.js';

/** HTTP adapter: validates, dispatches commands/queries, never touches a repository. */
@Controller('tickets')
@UseFilters(TicketErrorsFilter)
export class TicketsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  findAll(): Promise<Ticket[]> {
    return this.queryBus.execute<ListTicketsQuery, Ticket[]>(new ListTicketsQuery());
  }

  @Get(':id')
  findOne(@Param('id', { schema: ticketIdSchema }) id: string): Promise<Ticket> {
    return this.queryBus.execute<GetTicketQuery, Ticket>(new GetTicketQuery(id));
  }

  @Post()
  async create(
    @Body({ schema: createTicketSchema }) dto: CreateTicketDto,
    @CurrentUser() user: AuthUser,
  ): Promise<Ticket> {
    const id = await this.commandBus.execute<CreateTicketCommand, string>(
      new CreateTicketCommand(dto, user.sub),
    );
    return this.queryBus.execute<GetTicketQuery, Ticket>(new GetTicketQuery(id));
  }

  @Patch(':id')
  async update(
    @Param('id', { schema: ticketIdSchema }) id: string,
    @Body({ schema: updateTicketSchema }) dto: UpdateTicketDto,
    @CurrentUser() user: AuthUser,
  ): Promise<Ticket> {
    await this.commandBus.execute<UpdateTicketCommand, void>(
      new UpdateTicketCommand(id, dto, user.sub),
    );
    return this.queryBus.execute<GetTicketQuery, Ticket>(new GetTicketQuery(id));
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @Param('id', { schema: ticketIdSchema }) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.commandBus.execute<DeleteTicketCommand, void>(new DeleteTicketCommand(id, user.sub));
  }
}
