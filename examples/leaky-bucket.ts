import { createClient } from 'redis';
import { LeakyBucket } from '@marufzak/rlimiter';

const redisClient = createClient();
await redisClient.connect();

const strategy = new LeakyBucket({
  capacity: 10,
  leakRate: 1, // requests per second
  redisClient,
});

const { isAllowed, remainingRequests, remainingTime } = await strategy.check({
  queueKey: 'queue:user-123',
  timestampKey: 'timestamp:user-123',
});

if (!isAllowed) {
  console.log('Rate limit exceeded');
}
