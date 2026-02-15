import type { RedisClientType } from 'redis';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { createRedisClient } from '../utils';

let redisClient: RedisClientType;

beforeAll(async () => {
  const { client } = await createRedisClient();

  redisClient = client;
});

beforeEach(async () => {
  await redisClient.flushAll();
});

afterAll(() => {
  try {
    redisClient.destroy();
  } catch (err) {
    console.log('Error while closing redis client', err);
  }
});

export { redisClient };
