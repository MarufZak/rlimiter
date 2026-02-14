import RateLimiter from '../src';
import { redisClient } from './hooks/redis';
import { wait } from './utils';

describe('rate-limiter', () => {
  it('allows requests', async () => {
    const limiter = new RateLimiter({
      maxTokens: 5,
      refillSeconds: 1,
      redisClient,
    });

    const key = `user-1`;

    const responses = await Promise.all([
      limiter.check(key),
      limiter.check(key),
      limiter.check(key),
      limiter.check(key),
      limiter.check(key),
    ]);

    expect(responses).toEqual([true, true, true, true, true]);
  });

  it('rejects requests', async () => {
    const limiter = new RateLimiter({
      maxTokens: 1,
      refillSeconds: 1,
      redisClient,
    });

    const key = `user-1`;

    const response1 = await limiter.check(key);
    const response2 = await limiter.check(key);

    expect(response1).toBe(true);
    expect(response2).toBe(false);
  });

  it('handles multiple keys correctly', async () => {
    const key1 = `user-1`;
    const key2 = `user-2`;

    const limiter = new RateLimiter({
      maxTokens: 1,
      refillSeconds: 1,
      redisClient,
    });

    const response1 = await limiter.check(key1);

    const response2 = await limiter.check(key2);
    const response3 = await limiter.check(key2);

    expect(response1).toBe(true);
    expect(response2).toBe(true);
    expect(response3).toBe(false);
  });

  it('token refill works correctly', async () => {
    const limiter = new RateLimiter({
      maxTokens: 1,
      refillSeconds: 1,
      redisClient,
    });

    const key = `user-1`;

    const response1 = await limiter.check(key);
    const response2 = await limiter.check(key);
    expect(response1).toBe(true);
    expect(response2).toBe(false);

    await wait(1000);

    const response3 = await limiter.check(key);
    const response4 = await limiter.check(key);
    expect(response3).toBe(true);
    expect(response4).toBe(false);
  });

  it('partial token consuption', async () => {
    const limiter = new RateLimiter({
      maxTokens: 3,
      refillSeconds: 1,
      redisClient,
    });

    const key = `user-1`;

    const responses = await Promise.all([
      limiter.check(key),
      limiter.check(key),
    ]);

    expect(responses).toEqual([true, true]);

    await wait(1000);

    const responses2 = await Promise.all([
      limiter.check(key),
      limiter.check(key),
      limiter.check(key),
      limiter.check(key),
    ]);

    const success = responses2.filter(response => response === true);
    const fail = responses2.filter(response => response === false);

    expect(success.length).toBe(3);
    expect(fail.length).toBe(1);
  });
});
