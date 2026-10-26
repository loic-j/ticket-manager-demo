import { describe, expect, it } from 'vitest';
import { annotateSpan, cacheMetrics, count, currentTraceId } from './metrics.js';

describe('metrics helpers without an SDK', () => {
  it('are no-ops that never throw', () => {
    expect(() => count(cacheMetrics.operations, { operation: 'get', result: 'hit' })).not.toThrow();
    expect(() => annotateSpan({ 'ticket.id': 'x' })).not.toThrow();
    expect(currentTraceId()).toBeUndefined();
  });
});
