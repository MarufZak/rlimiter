import { describe, expect, it, vi } from 'vitest';
import { SlidingWindowCount } from '../../src/strategies/sliding-window-count';
import { redisClient } from '../hooks/redis';
import { RLimiterError } from '../../src/errors';

describe('Sliding window log', () => {
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
