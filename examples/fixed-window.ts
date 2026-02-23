import { createClient } from 'redis';
import { FixedWindow } from '@marufzak/rlimiter';

const redisClient = createClient();
await redisClient.connect();

const strategy = new FixedWindow({
  maxTokens: 10,
  windowSizeMs: 60000,
  redisClient,
});

const { isAllowed, remainingRequests, remainingTime } = await strategy.check({
  key: 'user-123',
});

if (!isAllowed) {
  console.log('Rate limit exceeded');
}
