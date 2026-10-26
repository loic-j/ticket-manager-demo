import type { DynamicModule, INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger, LoggerModule, type Params } from 'nestjs-pino';
import type { IncomingMessage, ServerResponse } from 'node:http';

const HEALTH_PATH = '/health';

/**
 * pino as the NestJS logger, configured from `ConfigService`:
 * - `LOG_LEVEL` (default `info`; `silent` in tests), `LOG_PRETTY=true` for a readable terminal.
 * - JSON records otherwise, with `trace_id` / `span_id` added by the pino instrumentation and the
 *   same records exported over OTLP (so `pnpm dev` processes are visible in Loki too).
 * - One line per HTTP request (method, route, status, duration) except the liveness probe;
 *   4xx are warnings, 5xx errors. Authorization and cookie headers are redacted.
 * Register it once, in the root module of each process; `new Logger(X)` from `@nestjs/common`
 * keeps working and goes through pino once `useTelemetryLogger(app)` has run.
 */
export function createLoggerModule(): DynamicModule {
  return LoggerModule.forRootAsync({
    inject: [ConfigService],
    useFactory: (config: ConfigService): Params => ({
      pinoHttp: {
        level: config.get<string>('LOG_LEVEL', 'info'),
        transport:
          config.get<string>('LOG_PRETTY') === 'true'
            ? {
                target: 'pino-pretty',
                options: { singleLine: true, translateTime: 'HH:MM:ss.l', ignore: 'pid,hostname' },
              }
            : undefined,
        redact: ['req.headers.authorization', 'req.headers.cookie'],
        autoLogging: {
          ignore: (req: IncomingMessage) => req.url === HEALTH_PATH,
        },
        customLogLevel: (_req: IncomingMessage, res: ServerResponse, error?: Error) => {
          if (error || res.statusCode >= 500) return 'error';
          if (res.statusCode >= 400) return 'warn';
          return 'info';
        },
        serializers: {
          req: (req: { id: unknown; method: string; url: string }) => ({
            id: req.id,
            method: req.method,
            url: req.url,
          }),
          res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
        },
      },
    }),
  });
}

/** Routes Nest's logger through pino. Call right after `NestFactory.create(…, { bufferLogs: true })`. */
export function useTelemetryLogger(app: INestApplicationContext): void {
  app.useLogger(app.get(Logger));
  app.flushLogs();
}
