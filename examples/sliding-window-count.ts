// Requires Redis 7.4+ (uses HPEXPIRE for per-field hash expiration)

import { createClient } from 'redis';
import { SlidingWindowCount } from '@marufzak/rlimiter';

const redisClient = createClient();
await redisClient.connect();

const strategy = new SlidingWindowCount({
  limit: 10,
  windowSizeMs: 60_000, // 60 second window
  subWindowSizeMs: 10_000, // 10 second sub-windows
  redisClient,
});

const { isAllowed, remainingRequests, remainingTime } = await strategy.check({
  hashKey: 'swc:user-123',
});

if (!isAllowed) {
  console.log('Rate limit exceeded');
}
