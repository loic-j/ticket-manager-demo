import { Catch, NotFoundException, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { NotificationNotFoundError } from '../domain/notification-not-found.error.js';

@Catch(NotificationNotFoundError)
export class NotificationErrorsFilter extends BaseExceptionFilter implements ExceptionFilter {
  override catch(error: NotificationNotFoundError, host: ArgumentsHost): void {
    super.catch(new NotFoundException(error.message), host);
  }
}
