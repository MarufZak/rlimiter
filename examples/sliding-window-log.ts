import { createClient } from 'redis';
import { SlidingWindowLog } from '@marufzak/rlimiter';

const redisClient = createClient();
await redisClient.connect();

const strategy = new SlidingWindowLog({
  capacity: 10,
  windowMs: 60_000, // 60 second window
  redisClient,
});

const { isAllowed, remainingRequests, remainingTime } = await strategy.check({
  queueKey: 'sliding:user-123',
});

if (!isAllowed) {
  console.log('Rate limit exceeded');
}
