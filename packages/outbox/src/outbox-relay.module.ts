import { Module, type DynamicModule, type ModuleMetadata } from '@nestjs/common';
import { EVENT_PUBLISHER } from './event-publisher.js';
import { OutboxDatabase } from './outbox-database.js';
import { OUTBOX_RELAY_CONFIG, type OutboxRelayConfig } from './outbox-relay.config.js';
import { OutboxRelay } from './outbox-relay.js';
import { RabbitMqEventPublisher } from './rabbitmq-event-publisher.js';

export interface OutboxRelayAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  useFactory: (...deps: never[]) => OutboxRelayConfig | Promise<OutboxRelayConfig>;
  inject?: unknown[];
}

/**
 * The outbox relay as a module: starts polling on init. Import it from a headless entry point
 * only (a dedicated relay process / image), never from an HTTP application module.
 */
@Module({})
export class OutboxRelayModule {
  static forRoot(config: OutboxRelayConfig): DynamicModule {
    return this.build({ provide: OUTBOX_RELAY_CONFIG, useValue: config });
  }

  static forRootAsync(options: OutboxRelayAsyncOptions): DynamicModule {
    return this.build(
      {
        provide: OUTBOX_RELAY_CONFIG,
        useFactory: options.useFactory,
        inject: options.inject as never[],
      },
      options.imports,
    );
  }

  private static build(
    configProvider: NonNullable<DynamicModule['providers']>[number],
    imports: ModuleMetadata['imports'] = [],
  ): DynamicModule {
    return {
      module: OutboxRelayModule,
      imports,
      providers: [
        configProvider,
        OutboxDatabase,
        { provide: EVENT_PUBLISHER, useClass: RabbitMqEventPublisher },
        OutboxRelay,
      ],
    };
  }
}
