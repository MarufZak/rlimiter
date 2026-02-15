import { describe, expect, it } from 'vitest';
import { TokenBucketStrategy } from '../../src/strategies';
import { redisClient } from '../hooks/redis';

describe('Token bucket', () => {
  it('allows requests', async () => {
    const limiter = new TokenBucketStrategy({
      redisClient,
      capacity: 5,
      replenishRate: 5,
    });

    const keys = { bucketKey: 'bucket-1', timestampKey: 'timestamp-1' };

    const responses = await Promise.all([
      limiter.check(keys),
      limiter.check(keys),
      limiter.check(keys),
      limiter.check(keys),
      limiter.check(keys),
    ]);

    const boolean = responses.map(response => response.isAllowed);
    const remaining = responses
      .map(response => response.remainingRequests)
      .toSorted();
    const ttl = responses.map(response => response.remainingTime);

    expect(boolean).toEqual([true, true, true, true, true]);
    expect(remaining).toEqual([0, 1, 2, 3, 4]);
    expect(ttl.every(item => item > 0)).toBe(true);
  });
});
