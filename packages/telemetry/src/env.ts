import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

/**
 * Loads `.env` of the current directory into `process.env` for the variables that are not set
 * yet. The SDK is configured from the environment before NestJS (and its `ConfigModule`, which
 * loads the same file later) has started, so the telemetry variables of a service's `.env` would
 * otherwise be ignored in development. Variables already present (Docker, shell) always win.
 */
export function loadDotEnv(path = '.env'): void {
  if (!existsSync(path)) return;
  for (const [key, value] of Object.entries(parseEnv(readFileSync(path, 'utf8')))) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
