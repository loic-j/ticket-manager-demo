import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadDotEnv } from './env.js';

describe('loadDotEnv', () => {
  const keys = ['TELEMETRY_TEST_A', 'TELEMETRY_TEST_B'];
  afterEach(() => {
    for (const key of keys) delete process.env[key];
  });

  it('fills missing variables and never overrides existing ones', () => {
    const dir = mkdtempSync(join(tmpdir(), 'telemetry-'));
    const file = join(dir, '.env');
    writeFileSync(file, 'TELEMETRY_TEST_A=from-file\nTELEMETRY_TEST_B=from-file\n');
    process.env.TELEMETRY_TEST_B = 'from-shell';
    loadDotEnv(file);
    expect(process.env.TELEMETRY_TEST_A).toBe('from-file');
    expect(process.env.TELEMETRY_TEST_B).toBe('from-shell');
  });

  it('ignores a missing file', () => {
    expect(() => loadDotEnv('/nonexistent/.env')).not.toThrow();
  });
});
