import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OutboxRelayModule, loadOutboxRelayConfig } from '@ticketmanager/outbox';

/** Root module of the relay process: no HTTP, no auth, no ORM, no controllers. */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    OutboxRelayModule.forRootAsync({
      useFactory: (config: ConfigService) => loadOutboxRelayConfig(config),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
