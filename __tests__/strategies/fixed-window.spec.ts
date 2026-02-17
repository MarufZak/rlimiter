import { describe, it, expect, vi } from 'vitest';
import { FixedWindow, LeakyBucket } from '../../src/strategies';
import { redisClient } from '../hooks/redis';
import { wait } from '../utils';
import { RLimiterError } from '../../src/errors';

describe('Fixed window', () => {
  it('allows requests', async () => {
    const limiter = new FixedWindow({
      redisClient,
      maxTokens: 5,
      refillMs: 1000,
    });

    const key = `user-1`;

    const responses = await Promise.all([
      limiter.check({ key }),
      limiter.check({ key }),
      limiter.check({ key }),
      limiter.check({ key }),
      limiter.check({ key }),
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

  it('rejects requests', async () => {
    const limiter = new FixedWindow({
      redisClient,
      maxTokens: 1,
      refillMs: 1000,
    });

    const key = `user-1`;

    const response1 = await limiter.check({ key });
    expect(response1.isAllowed).toBe(true);
    expect(response1.remainingRequests).toBe(0);

    const response2 = await limiter.check({ key });
    expect(response2.isAllowed).toBe(false);
    expect(response2.remainingRequests).toBe(0);
  });

  it('handles fractions', async () => {
    const key = `user-1`;

    const limiter = new FixedWindow({
      redisClient,
      maxTokens: 2.5,
      refillMs: 100,
    });

    const responses1 = await Promise.all([
      limiter.check({ key }),
      limiter.check({ key }),
      limiter.check({ key }),
    ]);

    const isAllowed1 = responses1.map(response => response.isAllowed).sort();
    const remainingRequests1 = responses1
      .map(response => response.remainingRequests)
      .sort();
    expect(isAllowed1).toEqual([false, true, true]);
    expect(remainingRequests1).toEqual([0, 0, 1]);

    await wait(100);

    const responses2 = await Promise.all([
      limiter.check({ key }),
      limiter.check({ key }),
      limiter.check({ key }),
    ]);

    const isAllowed2 = responses2.map(response => response.isAllowed).sort();
    const remainingRequests2 = responses2
      .map(response => response.remainingRequests)
      .sort();
    expect(isAllowed1).toEqual([false, true, true]);
    expect(remainingRequests1).toEqual([0, 0, 1]);
  });

  it('handles multiple keys correctly', async () => {
    const key1 = `user-1`;
    const key2 = `user-2`;

    const limiter = new FixedWindow({
      redisClient,
      maxTokens: 1,
      refillMs: 1000,
    });

    const response1 = await limiter.check({ key: key1 });
    expect(response1.isAllowed).toBe(true);
    expect(response1.remainingRequests).toBe(0);

    const response2 = await limiter.check({ key: key2 });
    expect(response2.isAllowed).toBe(true);
    expect(response2.remainingRequests).toBe(0);

    const response3 = await limiter.check({ key: key2 });
    expect(response3.isAllowed).toBe(false);
    expect(response3.remainingRequests).toBe(0);
  });

  it('token refill works correctly', async () => {
    const limiter = new FixedWindow({
      redisClient,
      maxTokens: 1,
      refillMs: 1000,
    });

    const key = `user-1`;

    const response1 = await limiter.check({ key });
    expect(response1.isAllowed).toBe(true);
    expect(response1.remainingRequests).toBe(0);

    const response2 = await limiter.check({ key });
    expect(response2.isAllowed).toBe(false);
    expect(response2.remainingRequests).toBe(0);

    await wait(1000);

    const response3 = await limiter.check({ key });
    expect(response3.isAllowed).toBe(true);
    expect(response3.remainingRequests).toBe(0);

    const response4 = await limiter.check({ key });
    expect(response4.isAllowed).toBe(false);
    expect(response4.remainingRequests).toBe(0);
  });

  it('partial token consuption', async () => {
    const limiter = new FixedWindow({
      redisClient,
      maxTokens: 3,
      refillMs: 1000,
    });

    const key = `user-1`;

    const responses = await Promise.all([
      limiter.check({ key }),
      limiter.check({ key }),
    ]);

    const isAllowed1 = responses.map(response => response.isAllowed);
    const remaining1 = responses
      .map(response => response.remainingRequests)
      .sort();

    expect(isAllowed1).toEqual([true, true]);
    expect(remaining1).toEqual([1, 2]);

    await wait(1000);

    const responses2 = await Promise.all([
      limiter.check({ key }),
      limiter.check({ key }),
      limiter.check({ key }),
      limiter.check({ key }),
    ]);

    const isAllowed2 = responses2.map(response => response.isAllowed).sort();
    const remaining2 = responses2
      .map(response => response.remainingRequests)
      .sort();

    expect(isAllowed2).toEqual([false, true, true, true]);
    expect(remaining2).toEqual([0, 0, 1, 2]);
  });

  it('throws error on invalid params', async () => {
    expect(
      () =>
        new FixedWindow({
          maxTokens: 0,
          refillMs: 1,
          redisClient,
        })
    ).toThrow(RLimiterError);

    expect(
      () =>
        new FixedWindow({
          maxTokens: 1,
          refillMs: 0,
          redisClient,
        })
    ).toThrow(RLimiterError);
  });

  it('onError works correctly', async () => {
    const errorCb = vi.fn();

    const limiter = new FixedWindow({
      redisClient,
      maxTokens: 3,
      refillMs: 1000,
      onError: errorCb,
    });

    const key = `user-1`;

    await redisClient.close();
    const { isAllowed, remainingRequests, remainingTime } = await limiter.check(
      { key }
    );

    expect(errorCb).toHaveBeenCalledOnce();
    expect(isAllowed).toBe(false);
    expect(remainingRequests).toBe(0);
    expect(remainingTime).toBe(0);
  });
});
