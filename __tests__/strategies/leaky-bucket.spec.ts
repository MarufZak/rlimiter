import { describe, expect, it, vi } from 'vitest';
import { LeakyBucket } from '../../src/strategies';
import { redisClient } from '../hooks/redis';
import { wait } from '../utils';

describe('Leaky bucket', () => {
  it('allows requests', async () => {
    const limiter = new LeakyBucket({
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
    const limiter = new LeakyBucket({
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

  it('handles multiple keys correctly', async () => {
    const limiter = new LeakyBucket({
      capacity: 3,
      leakRate: 1,
      redisClient,
    });

    const keys1 = {
      queueKey: 'queue-1',
      timestampKey: 'timestamp-1',
    };

    const keys2 = {
      queueKey: 'queue-2',
      timestampKey: 'timestamp-2',
    };

    const responses1 = await Promise.all([
      limiter.check(keys1),
      limiter.check(keys1),
      limiter.check(keys1),
      limiter.check(keys1),
    ]);

    const responses2 = await Promise.all([
      limiter.check(keys2),
      limiter.check(keys2),
      limiter.check(keys2),
      limiter.check(keys2),
    ]);

    const isAllowed1 = responses1.map(response => response.isAllowed).sort();
    const isAllowed2 = responses2.map(response => response.isAllowed).sort();

    expect(isAllowed1).toEqual([false, true, true, true]);
    expect(isAllowed2).toEqual([false, true, true, true]);
  });

  it('token refilling works correctly', async () => {
    const limiter = new LeakyBucket({
      capacity: 3,
      leakRate: 1,
      redisClient,
    });

    const keys = {
      queueKey: 'queue-1',
      timestampKey: 'timestamp-1',
    };

    await Promise.all([
      limiter.check(keys),
      limiter.check(keys),
      limiter.check(keys),
    ]);

    await wait(500);

    const response1 = await limiter.check(keys);
    expect(response1.isAllowed).toBe(false);

    await wait(500);

    const response2 = await limiter.check(keys);
    expect(response2.isAllowed).toBe(true);

    await wait(3000);

    const responses = await Promise.all([
      limiter.check(keys),
      limiter.check(keys),
      limiter.check(keys),
      limiter.check(keys),
    ]);

    const isAllowed = responses.map(response => response.isAllowed).sort();
    expect(isAllowed).toEqual([false, true, true, true]);
  });

  it('invokes onError when redis fails', async () => {
    const errorCb = vi.fn();

    const limiter = new LeakyBucket({
      redisClient,
      capacity: 3,
      leakRate: 1,
      onError: errorCb,
    });

    const keys = {
      queueKey: 'queue-1',
      timestampKey: 'timestamp-1',
    };

    await redisClient.close();
    await limiter.check(keys);

    expect(errorCb).toHaveBeenCalledOnce();
  });
});
