import { describe, expect, it, vi } from 'vitest';
import { RLimiterError } from '../../src/errors';
import { FixedWindow } from '../../src/strategies';
import { redisClient } from '../hooks/redis';
import { wait } from '../utils';

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

    const isAllowed = responses.map(response => response.isAllowed);
    const remainingRequests = responses
      .map(response => response.remainingRequests)
      .sort();
    const remainingTime = responses
      .map(response => response.remainingTime)
      .sort();

    expect(isAllowed).toEqual([true, true, true, true, true]);
    expect(remainingRequests).toEqual([0, 1, 2, 3, 4]);
    expect(remainingTime).toEqual([0, 0, 0, 0, 0]);
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
    expect(response1.remainingTime).toBe(0);

    const response2 = await limiter.check({ key });
    expect(response2.isAllowed).toBe(false);
    expect(response2.remainingRequests).toBe(0);
    expect(response2.remainingTime).toBeGreaterThan(0);
  });

  it('handles fraction options', async () => {
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
    const remainingTime1 = responses1
      .map(response => response.remainingTime)
      .sort();

    expect(isAllowed1).toEqual([false, true, true]);
    expect(remainingRequests1).toEqual([0, 0, 1]);
    expect(remainingTime1[0]).toBe(0);
    expect(remainingTime1[1]).toBe(0);
    expect(remainingTime1[2]).toBeGreaterThan(0);

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
    const remainingTime2 = responses2
      .map(response => response.remainingTime)
      .sort();

    expect(isAllowed2).toEqual([false, true, true]);
    expect(remainingRequests2).toEqual([0, 0, 1]);
    expect(remainingTime2[0]).toBe(0);
    expect(remainingTime2[1]).toBe(0);
    expect(remainingTime2[2]).toBeGreaterThan(0);
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
    expect(response1.remainingTime).toBe(0);

    const response2 = await limiter.check({ key: key2 });
    expect(response2.isAllowed).toBe(true);
    expect(response2.remainingRequests).toBe(0);
    expect(response2.remainingTime).toBe(0);

    const response3 = await limiter.check({ key: key2 });
    expect(response3.isAllowed).toBe(false);
    expect(response3.remainingRequests).toBe(0);
    expect(response3.remainingTime).toBeGreaterThan(0);
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
    expect(response1.remainingTime).toBe(0);

    const response2 = await limiter.check({ key });
    expect(response2.isAllowed).toBe(false);
    expect(response2.remainingRequests).toBe(0);
    expect(response2.remainingTime).toBeGreaterThan(0);

    await wait(1000);

    const response3 = await limiter.check({ key });
    expect(response3.isAllowed).toBe(true);
    expect(response3.remainingRequests).toBe(0);
    expect(response3.remainingTime).toBe(0);

    const response4 = await limiter.check({ key });
    expect(response4.isAllowed).toBe(false);
    expect(response4.remainingRequests).toBe(0);
    expect(response4.remainingTime).toBeGreaterThan(0);
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

    const isAllowed1 = responses.map(response => response.isAllowed).sort();
    const remainingRequests1 = responses
      .map(response => response.remainingRequests)
      .sort();
    const remainingTime1 = responses
      .map(response => response.remainingTime)
      .sort();

    expect(isAllowed1).toEqual([true, true]);
    expect(remainingRequests1).toEqual([1, 2]);
    expect(remainingTime1).toEqual([0, 0]);

    await wait(1000);

    const responses2 = await Promise.all([
      limiter.check({ key }),
      limiter.check({ key }),
      limiter.check({ key }),
      limiter.check({ key }),
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
    expect(remainingTime2.slice(0, remainingTime2.length - 1)).toEqual([
      0, 0, 0,
    ]);
    expect(remainingTime2.at(-1)).toBeGreaterThan(0);
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
