import type { z } from 'zod';

/** The part of NestJS `ConfigService` the loaders need. */
export interface ConfigReader {
  get<T = string>(key: string): T | undefined;
}
/** A `ConfigService`, or a plain env object (tests). */
export type EnvSource = ConfigReader | Partial<Record<string, string | undefined>>;

function isConfigReader(source: EnvSource): source is ConfigReader {
  return 'get' in source && typeof source.get === 'function';
}

/**
 * Reads the keys of a Zod object schema from a `ConfigService`-like source (which loaded `.env`)
 * or from a plain object, then validates them. Shared by every service config loader so the
 * "read through ConfigService, validate with Zod" rule is implemented once.
 */
export function readEnv<S extends z.ZodObject<z.ZodRawShape>>(
  schema: S,
  source: EnvSource,
): z.output<S> {
  const env = isConfigReader(source)
    ? Object.fromEntries(Object.keys(schema.shape).map((key) => [key, source.get<string>(key)]))
    : source;
  return schema.parse(env);
}
