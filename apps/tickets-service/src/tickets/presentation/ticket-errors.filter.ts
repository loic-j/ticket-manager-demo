import {
  Catch,
  ConflictException,
  NotFoundException,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { ConcurrencyConflictError } from '../domain/concurrency-conflict.error.js';
import { TicketNotFoundError } from '../domain/ticket-not-found.error.js';

/** Translates domain errors into HTTP responses so the application layer stays HTTP-agnostic. */
@Catch(TicketNotFoundError, ConcurrencyConflictError)
export class TicketErrorsFilter extends BaseExceptionFilter implements ExceptionFilter {
  override catch(error: TicketNotFoundError | ConcurrencyConflictError, host: ArgumentsHost): void {
    const http =
      error instanceof ConcurrencyConflictError
        ? new ConflictException(error.message)
        : new NotFoundException(error.message);
    super.catch(http, host);
  }
}
