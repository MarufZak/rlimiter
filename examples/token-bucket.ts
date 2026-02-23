import { createClient } from 'redis';
import { TokenBucket } from '@marufzak/rlimiter';

const redisClient = createClient();
await redisClient.connect();

const strategy = new TokenBucket({
  capacity: 10,
  replenishRate: 1, // tokens per second
  redisClient,
});

const { isAllowed, remainingRequests, remainingTime } = await strategy.check({
  bucketKey: 'bucket:user-123',
  timestampKey: 'timestamp:user-123',
});

if (!isAllowed) {
  console.log('Rate limit exceeded');
}
