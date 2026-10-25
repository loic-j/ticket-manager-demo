import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { USER_DIRECTORY } from './application/ports/index.js';
import { USER_QUERY_HANDLERS } from './application/queries/index.js';
import { CachingUserDirectory } from './infrastructure/caching-user-directory.js';
import { LogtoUserDirectory } from './infrastructure/logto-user-directory.js';
import { UsersController } from './presentation/users.controller.js';
import { USERS_CONFIG, loadUsersConfig, type UsersConfig } from './users.config.js';

@Module({
  imports: [CqrsModule],
  controllers: [UsersController],
  providers: [
    ...USER_QUERY_HANDLERS,
    {
      provide: USERS_CONFIG,
      useFactory: (config: ConfigService) => loadUsersConfig(config),
      inject: [ConfigService],
    },
    {
      provide: USER_DIRECTORY,
      useFactory: (config: UsersConfig) =>
        new CachingUserDirectory(new LogtoUserDirectory(config), config.cache),
      inject: [USERS_CONFIG],
    },
  ],
})
export class UsersModule {}
