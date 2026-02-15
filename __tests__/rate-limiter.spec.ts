import { describe, it, expect, vi } from 'vitest';
import RateLimiter from '../src';
import { FixedWindowStrategy } from '../src/strategies';
import { redisClient } from './hooks/redis';
import { wait } from './utils';

describe('rate-limiter', () => {
  it('allows requests', async () => {
    const limiter = new RateLimiter({
      redisClient,
      strategy: new FixedWindowStrategy({
        maxTokens: 5,
        refillMs: 1000,
      }),
    });

    const key = `user-1`;

    const responses = (
      await Promise.all([
        limiter.check(key),
        limiter.check(key),
        limiter.check(key),
        limiter.check(key),
        limiter.check(key),
      ])
    ).map(response => response.isAllowed);

    expect(responses).toEqual([true, true, true, true, true]);
  });

  it('rejects requests', async () => {
    const limiter = new RateLimiter({
      redisClient,
      strategy: new FixedWindowStrategy({
        maxTokens: 1,
        refillMs: 1000,
      }),
    });

    const key = `user-1`;

    const response1 = await limiter.check(key);
    const response2 = await limiter.check(key);

    expect(response1.isAllowed).toBe(true);
    expect(response2.isAllowed).toBe(false);
  });

  it('handles multiple keys correctly', async () => {
    const key1 = `user-1`;
    const key2 = `user-2`;

    const limiter = new RateLimiter({
      redisClient,
      strategy: new FixedWindowStrategy({
        maxTokens: 1,
        refillMs: 1000,
      }),
    });

    const response1 = await limiter.check(key1);

    const response2 = await limiter.check(key2);
    const response3 = await limiter.check(key2);

    expect(response1.isAllowed).toBe(true);
    expect(response2.isAllowed).toBe(true);
    expect(response3.isAllowed).toBe(false);
  });

  it('token refill works correctly', async () => {
    const limiter = new RateLimiter({
      redisClient,
      strategy: new FixedWindowStrategy({
        maxTokens: 1,
        refillMs: 1000,
      }),
    });

    const key = `user-1`;

    const response1 = await limiter.check(key);
    const response2 = await limiter.check(key);
    expect(response1.isAllowed).toBe(true);
    expect(response2.isAllowed).toBe(false);

    await wait(1000);

    const response3 = await limiter.check(key);
    const response4 = await limiter.check(key);
    expect(response3.isAllowed).toBe(true);
    expect(response4.isAllowed).toBe(false);
  });

  it('partial token consuption', async () => {
    const limiter = new RateLimiter({
      redisClient,
      strategy: new FixedWindowStrategy({
        maxTokens: 3,
        refillMs: 1000,
      }),
    });

    const key = `user-1`;

    const responses = (
      await Promise.all([limiter.check(key), limiter.check(key)])
    ).map(response => response.isAllowed);

    expect(responses).toEqual([true, true]);

    await wait(1000);

    const responses2 = await Promise.all([
      limiter.check(key),
      limiter.check(key),
      limiter.check(key),
      limiter.check(key),
    ]);

    const success = responses2.filter(response => response.isAllowed === true);
    const fail = responses2.filter(response => response.isAllowed === false);

    expect(success.length).toBe(3);
    expect(fail.length).toBe(1);
  });

  it('invokes onError when redis fails', async () => {
    const errorCb = vi.fn();

    const limiter = new RateLimiter({
      redisClient,
      strategy: new FixedWindowStrategy({
        maxTokens: 3,
        refillMs: 1000,
      }),
      onError: errorCb,
    });

    const key = `user-1`;

    await redisClient.close();
    await limiter.check(key);

    expect(errorCb).toHaveBeenCalledOnce();
  });
});
