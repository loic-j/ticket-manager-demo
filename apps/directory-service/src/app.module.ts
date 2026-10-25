import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DIRECTORY_API_RESOURCE } from '@ticketmanager/contracts';
import { AuthModule } from '@ticketmanager/nest-common';
import { HealthController } from './health/presentation/health.controller.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule.forRoot({ defaultAudience: DIRECTORY_API_RESOURCE }),
    UsersModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
