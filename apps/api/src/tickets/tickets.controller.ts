import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import {
  createTicketSchema,
  ticketIdSchema,
  updateTicketSchema,
  type CreateTicketDto,
  type Ticket,
  type UpdateTicketDto,
} from '@ticketmanager/shared';
import { TicketsService } from './tickets.service.js';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  findAll(): Ticket[] {
    return this.ticketsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', { schema: ticketIdSchema }) id: string): Ticket {
    return this.ticketsService.findOne(id);
  }

  @Post()
  create(@Body({ schema: createTicketSchema }) dto: CreateTicketDto): Ticket {
    return this.ticketsService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', { schema: ticketIdSchema }) id: string,
    @Body({ schema: updateTicketSchema }) dto: UpdateTicketDto,
  ): Ticket {
    return this.ticketsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', { schema: ticketIdSchema }) id: string): void {
    this.ticketsService.remove(id);
  }
}
