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
import { TicketsService } from '../application/tickets.service.js';
import { TicketErrorsFilter } from './ticket-errors.filter.js';

@Controller('tickets')
@UseFilters(TicketErrorsFilter)
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  findAll(): Promise<Ticket[]> {
    return this.ticketsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', { schema: ticketIdSchema }) id: string): Promise<Ticket> {
    return this.ticketsService.findOne(id);
  }

  @Post()
  create(
    @Body({ schema: createTicketSchema }) dto: CreateTicketDto,
    @CurrentUser() user: AuthUser,
  ): Promise<Ticket> {
    return this.ticketsService.create(dto, user.sub);
  }

  @Patch(':id')
  update(
    @Param('id', { schema: ticketIdSchema }) id: string,
    @Body({ schema: updateTicketSchema }) dto: UpdateTicketDto,
    @CurrentUser() user: AuthUser,
  ): Promise<Ticket> {
    return this.ticketsService.update(id, dto, user.sub);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', { schema: ticketIdSchema }) id: string): Promise<void> {
    return this.ticketsService.remove(id);
  }
}
