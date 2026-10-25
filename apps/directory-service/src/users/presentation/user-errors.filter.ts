import { Catch, NotFoundException, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { UserNotFoundError } from '../domain/user-not-found.error.js';

@Catch(UserNotFoundError)
export class UserErrorsFilter extends BaseExceptionFilter implements ExceptionFilter {
  override catch(error: UserNotFoundError, host: ArgumentsHost): void {
    super.catch(new NotFoundException(error.message), host);
  }
}
