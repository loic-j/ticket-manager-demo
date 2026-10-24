import { Catch, NotFoundException, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { TicketNotFoundError } from '../domain/ticket-not-found.error.js';

/** Translates domain errors into HTTP responses so the application layer stays HTTP-agnostic. */
@Catch(TicketNotFoundError)
export class TicketErrorsFilter extends BaseExceptionFilter implements ExceptionFilter {
  override catch(error: TicketNotFoundError, host: ArgumentsHost): void {
    super.catch(new NotFoundException(error.message), host);
  }
}
