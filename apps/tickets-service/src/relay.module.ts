import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OutboxRelayModule, loadOutboxRelayConfig } from '@ticketmanager/outbox';

/** Root module of the outbox relay process: no HTTP, no auth, no Prisma, no controllers. */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    OutboxRelayModule.forRootAsync({
      useFactory: (config: ConfigService) => loadOutboxRelayConfig(config),
      inject: [ConfigService],
    }),
  ],
})
export class RelayModule {}
