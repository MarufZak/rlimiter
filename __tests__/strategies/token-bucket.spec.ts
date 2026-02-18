import { describe, expect, it, vi } from 'vitest';
import { TokenBucket } from '../../src/strategies';
import { redisClient } from '../hooks/redis';
import { wait } from '../utils';
import { RLimiterError } from '../../src/errors';

describe('Token bucket', () => {
  it('allows requests', async () => {
    const limiter = new TokenBucket({
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

    const isAllowed = responses.map(response => response.isAllowed);
    const remainingRequests = responses
      .map(response => response.remainingRequests)
      .sort();
    const remainingTime = responses
      .map(response => response.remainingTime)
      .sort();

    expect(isAllowed).toEqual([true, true, true, true, true]);
    expect(remainingRequests).toEqual([0, 1, 2, 3, 4]);
    expect(remainingTime).toEqual([0, 0, 0, 0, expect.any(Number)]);
  });

  it('rejects requests', async () => {
    const limiter = new TokenBucket({
      redisClient,
      capacity: 1,
      replenishRate: 1,
    });

    const keys = { bucketKey: 'bucket-1', timestampKey: 'timestamp-1' };

    const response1 = await limiter.check(keys);
    expect(response1.isAllowed).toBe(true);
    expect(response1.remainingRequests).toBe(0);
    expect(response1.remainingTime).toBe(0);

    const response2 = await limiter.check(keys);
    expect(response2.isAllowed).toBe(false);
    expect(response2.remainingRequests).toBe(0);
    expect(response2.remainingTime).toBeGreaterThan(0);
  });

  it('handles fraction options', async () => {
    const limiter = new TokenBucket({
      capacity: 2,
      replenishRate: 1.5,
      redisClient,
    });

    const keys = { bucketKey: 'bucket-1', timestampKey: 'timestamp-1' };

    const responses1 = await Promise.all([
      limiter.check(keys),
      limiter.check(keys),
      limiter.check(keys),
    ]);

    const isAllowed1 = responses1.map(response => response.isAllowed).sort();
    expect(isAllowed1).toEqual([false, true, true]);

    await wait(1000);

    const responses2 = await Promise.all([
      limiter.check(keys),
      limiter.check(keys),
    ]);

    const isAllowed2 = responses2.map(response => response.isAllowed).sort();
    expect(isAllowed2).toEqual([false, true]);
  });

  it('handles multiple keys correctly', async () => {
    const limiter = new TokenBucket({
      redisClient,
      capacity: 1,
      replenishRate: 1,
    });

    const keys1 = { bucketKey: 'bucket-1', timestampKey: 'timestamp-1' };
    const keys2 = { bucketKey: 'bucket-2', timestampKey: 'timestamp-2' };

    const response1 = await limiter.check(keys1);
    expect(response1.isAllowed).toBe(true);
    expect(response1.remainingRequests).toBe(0);
    expect(response1.remainingTime).toBe(0);

    const response2 = await limiter.check(keys2);
    expect(response2.isAllowed).toBe(true);
    expect(response2.remainingRequests).toBe(0);
    expect(response2.remainingTime).toBe(0);

    const response3 = await limiter.check(keys2);
    expect(response3.isAllowed).toBe(false);
    expect(response3.remainingRequests).toBe(0);
    expect(response3.remainingTime).toBeGreaterThan(0);
  });

  it('token refill works correctly', async () => {
    const limiter = new TokenBucket({
      redisClient,
      capacity: 1,
      replenishRate: 1,
    });

    const keys = { bucketKey: 'bucket-1', timestampKey: 'timestamp-1' };

    const response1 = await limiter.check(keys);
    expect(response1.isAllowed).toBe(true);
    expect(response1.remainingRequests).toBe(0);
    expect(response1.remainingTime).toBe(0);

    const response2 = await limiter.check(keys);
    expect(response2.isAllowed).toBe(false);
    expect(response2.remainingRequests).toBe(0);
    expect(response2.remainingTime).toBeGreaterThan(0);

    await wait(1000);

    const response3 = await limiter.check(keys);
    expect(response3.isAllowed).toBe(true);
    expect(response3.remainingRequests).toBe(0);
    expect(response3.remainingTime).toBe(0);

    const response4 = await limiter.check(keys);
    expect(response4.isAllowed).toBe(false);
    expect(response4.remainingRequests).toBe(0);
    expect(response4.remainingTime).toBeGreaterThan(0);
  });

  it('partial token consuption', async () => {
    const limiter = new TokenBucket({
      redisClient,
      capacity: 3,
      replenishRate: 3,
    });

    const keys = { bucketKey: 'bucket-1', timestampKey: 'timestamp-1' };

    const responses = await Promise.all([
      limiter.check(keys),
      limiter.check(keys),
    ]);

    const isAllowed1 = responses.map(response => response.isAllowed);
    const remainingRequests1 = responses
      .map(response => response.remainingRequests)
      .sort();
    const remainingTime1 = responses.map(response => response.remainingTime);

    expect(isAllowed1).toEqual([true, true]);
    expect(remainingRequests1).toEqual([1, 2]);
    expect(remainingTime1).toEqual([0, 0]);

    await wait(1000);

    const responses2 = await Promise.all([
      limiter.check(keys),
      limiter.check(keys),
      limiter.check(keys),
      limiter.check(keys),
    ]);

    const isAllowed2 = responses2.map(response => response.isAllowed).sort();
    const remainingRequests2 = responses2
      .map(response => response.remainingRequests)
      .sort();
    const remainingTime2 = responses2
      .map(response => response.remainingTime)
      .sort();

    expect(isAllowed2).toEqual([false, true, true, true]);
    expect(remainingRequests2).toEqual([0, 0, 1, 2]);
    expect(remainingTime2.slice(0, 3)).toEqual([0, 0, 0]);
    expect(remainingTime2.at(-1)).toBeGreaterThan(0);
  });

  it('throws error on invalid params', async () => {
    expect(
      () =>
        new TokenBucket({
          capacity: 0,
          replenishRate: 1,
          redisClient,
        })
    ).toThrow(RLimiterError);

    expect(
      () =>
        new TokenBucket({
          capacity: 1,
          replenishRate: 0,
          redisClient,
        })
    ).toThrow(RLimiterError);
  });

  it('onError works correctly', async () => {
    const errorCb = vi.fn();

    const limiter = new TokenBucket({
      redisClient,
      capacity: 3,
      replenishRate: 3,
      onError: errorCb,
    });

    const keys = { bucketKey: 'bucket-1', timestampKey: 'timestamp-1' };

    await redisClient.close();
    const { isAllowed, remainingRequests, remainingTime } =
      await limiter.check(keys);

    expect(errorCb).toHaveBeenCalledOnce();
    expect(isAllowed).toBe(false);
    expect(remainingRequests).toBe(0);
    expect(remainingTime).toBe(0);
  });
});
