import { type RedisClientType } from 'redis';
import { createRedisClient } from './utils';
import { createServer } from 'http';
import RateLimiter from '../src';

let redisClient: RedisClientType;

beforeAll(async () => {
  const { client } = await createRedisClient();

  if (!client) {
  }

  redisClient = client;
});

beforeAll(() => {
  const limiter = new RateLimiter({
    maxTokens: 5,
    refillSeconds: 1,
    redisClient,
  });

  const server = createServer(async (req, res) => {
    const userId = req.headers['x-user-id'];

    if (!userId || typeof userId !== 'string') {
      res.statusCode = 401;
      res.end();
      return;
    }

    const isAllowed = await limiter.check(userId);

    if (isAllowed) {
      res.statusCode = 200;
    } else {
      res.statusCode = 429;
    }

    res.end();
  });

  server.listen(3000, () => {
    console.log('server listening on port', 3000);
  });
});

describe('rate-limiter', () => {
  it('works correctly', async () => {
    const responses = await Promise.all([
      fetch('http://localhost:3000', { headers: { 'x-user-id': '1' } }),
      fetch('http://localhost:3000', { headers: { 'x-user-id': '1' } }),
      fetch('http://localhost:3000', { headers: { 'x-user-id': '1' } }),
      fetch('http://localhost:3000', { headers: { 'x-user-id': '1' } }),
      fetch('http://localhost:3000', { headers: { 'x-user-id': '1' } }),
      fetch('http://localhost:3000', { headers: { 'x-user-id': '1' } }),
      fetch('http://localhost:3000', { headers: { 'x-user-id': '1' } }),
    ]);

    const statuses = responses.map(response => response.status);

    expect(statuses[0]).toBe(200);
    expect(statuses[1]).toBe(200);
    expect(statuses[2]).toBe(200);
    expect(statuses[3]).toBe(200);
    expect(statuses[4]).toBe(200);
    expect(statuses[5]).toBe(429);
    expect(statuses[6]).toBe(429);
  });
});
