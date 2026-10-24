import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module.js';
import { OutboxRelayModule } from './messaging/outbox-relay.module.js';

/** Root module of the outbox relay process: no HTTP, no auth, no controllers. */
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule, OutboxRelayModule],
})
export class RelayModule {}
