import type { RedisClientType } from 'redis';
import { createRedisClient } from '../utils';
import { beforeAll, beforeEach, afterAll } from 'vitest';

let redisClient: RedisClientType;

beforeAll(async () => {
  const { client } = await createRedisClient();

  redisClient = client;
});

beforeEach(async () => {
  await redisClient.flushAll();
});

afterAll(() => {
  redisClient.destroy();
});

export { redisClient };
