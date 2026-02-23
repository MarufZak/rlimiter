import { describe, expect, it, vi } from 'vitest';
import { SlidingWindowCount } from '../../src/strategies/sliding-window-count';
import { redisClient } from '../hooks/redis';
import { RLimiterError } from '../../src/errors';
import { wait } from '../utils';

describe('Sliding window count', () => {
  it('allows requests', async () => {
    const limiter = new SlidingWindowCount({
      limit: 3,
      windowSizeMs: 900,
      subWindowSizeMs: 300,
      redisClient,
    });

    const keys = {
      hashKey: 'hash-1',
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
    const limiter = new SlidingWindowCount({
      limit: 2,
      windowSizeMs: 1000,
      subWindowSizeMs: 500,
      redisClient,
    });

    const keys = {
      hashKey: 'hash-1',
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
    const limiter = new SlidingWindowCount({
      limit: 3,
      windowSizeMs: 1000,
      subWindowSizeMs: 500,
      redisClient,
    });

    const keys1 = {
      hashKey: 'hash-1',
    };

    const keys2 = {
      hashKey: 'hash-2',
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
    const limiter = new SlidingWindowCount({
      limit: 3,
      windowSizeMs: 150,
      subWindowSizeMs: 50,
      redisClient,
    });

    const keys = {
      hashKey: 'hash-1',
    };

    const response1 = await limiter.check(keys);
    expect(response1.isAllowed).toBe(true);
    expect(response1.remainingRequests).toBe(2);
    expect(response1.remainingTime).toBe(0);

    await wait(50);

    const response2 = await limiter.check(keys);
    expect(response2.isAllowed).toBe(true);
    expect(response2.remainingRequests).toBe(1);
    expect(response2.remainingTime).toBe(0);

    await wait(50);

    const response3 = await limiter.check(keys);
    expect(response3.isAllowed).toBe(true);
    expect(response3.remainingRequests).toBe(0);
    expect(response3.remainingTime).toBe(0);

    const response4 = await limiter.check(keys);
    expect(response4.isAllowed).toBe(false);
    expect(response4.remainingRequests).toBe(0);
    expect(response4.remainingTime).toBeGreaterThan(0);

    await wait(50);

    const response5 = await limiter.check(keys);
    expect(response5.isAllowed).toBe(true);
    expect(response5.remainingRequests).toBe(0);
    expect(response5.remainingTime).toBe(0);

    const response6 = await limiter.check(keys);
    expect(response6.isAllowed).toBe(false);
    expect(response6.remainingRequests).toBe(0);
    expect(response6.remainingTime).toBeGreaterThan(0);

    await wait(150);

    const responses7 = await Promise.all([
      limiter.check(keys),
      limiter.check(keys),
      limiter.check(keys),
      limiter.check(keys),
    ]);

    const isAllowed7 = responses7.map(response => response.isAllowed).sort();
    const remainingRequests7 = responses7
      .map(response => response.remainingRequests)
      .sort();
    const remainingTime7 = responses7
      .map(response => response.remainingTime)
      .sort();

    expect(isAllowed7).toEqual([false, true, true, true]);
    expect(remainingRequests7).toEqual([0, 0, 1, 2]);
    expect(remainingTime7).toEqual([0, 0, 0, expect.any(Number)]);
    expect(remainingTime7.at(-1)).toBeGreaterThan(0);
  });

  it('throws error on invalid params', async () => {
    expect(
      () =>
        new SlidingWindowCount({
          limit: 0,
          windowSizeMs: 900,
          subWindowSizeMs: 300,
          redisClient,
        })
    ).toThrow(RLimiterError);

    expect(
      () =>
        new SlidingWindowCount({
          limit: 1,
          windowSizeMs: 0,
          subWindowSizeMs: 300,
          redisClient,
        })
    ).toThrow(RLimiterError);

    expect(
      () =>
        new SlidingWindowCount({
          limit: 1,
          windowSizeMs: 900,
          subWindowSizeMs: 0,
          redisClient,
        })
    ).toThrow(RLimiterError);
  });

  it('onError works correctly', async () => {
    const errorCb = vi.fn();

    const limiter = new SlidingWindowCount({
      redisClient,
      limit: 3,
      windowSizeMs: 900,
      subWindowSizeMs: 300,
      onError: errorCb,
    });

    const keys = {
      hashKey: 'hash-1',
    };

    await redisClient.close();
    const { isAllowed, remainingRequests, remainingTime } =
      await limiter.check(keys);

    expect(errorCb).toHaveBeenCalledOnce();
    expect(isAllowed).toBe(false);
    expect(remainingRequests).toBe(0);
    expect(remainingTime).toBe(0);
  });
});
