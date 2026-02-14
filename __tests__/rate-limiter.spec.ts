import { type RedisClientType } from 'redis';
import RateLimiter from '../src';
import { createRedisClient } from './utils';

let redisClient: RedisClientType;

beforeAll(async () => {
  const { client } = await createRedisClient();

  if (!client) {
  }

  redisClient = client;
});

beforeEach(async () => {
  await redisClient.flushAll();
});

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
});
