import { describe, expect, it } from 'vitest';
import { LeakyBucketStrategy } from '../../src/strategies';
import { redisClient } from '../hooks/redis';

describe('Leaky bucket', () => {
  it('allows requests', async () => {
    const limiter = new LeakyBucketStrategy({
      capacity: 3,
      leakRate: 1,
      redisClient,
    });

    const keys = {
      queueKey: 'queue-1',
      timestampKey: 'timestamp-1',
    };

    const responses = await Promise.all([
      limiter.check(keys),
      limiter.check(keys),
      limiter.check(keys),
    ]);

    const isAllowed = responses.map(response => response.isAllowed);
    const remainingRequests = responses
      .map(response => response.remainingRequests)
      .sort();
    const remainingTime = responses
      .map(response => response.remainingTime)
      .sort();

    expect(isAllowed).toEqual([true, true, true]);
    expect(remainingRequests).toEqual([0, 1, 2]);
    expect(remainingTime).toEqual([0, 0, 0]);
  });

  it('rejects requests', async () => {
    const limiter = new LeakyBucketStrategy({
      capacity: 2,
      leakRate: 1,
      redisClient,
    });

    const keys = {
      queueKey: 'queue-1',
      timestampKey: 'timestamp-1',
    };

    const responses = await Promise.all([
      limiter.check(keys),
      limiter.check(keys),
      limiter.check(keys),
    ]);

    const isAllowed = responses.map(response => response.isAllowed).sort();
    const remainingRequests = responses
      .map(response => response.remainingRequests)
      .sort();
    const remainingTime = responses
      .map(response => response.remainingTime)
      .sort();

    expect(isAllowed).toEqual([false, true, true]);
    expect(remainingRequests).toEqual([0, 0, 1]);
    expect(remainingTime).toEqual([0, 0, expect.any(Number)]);
    expect(remainingTime[2]).toBeGreaterThan(0);
  });
});
