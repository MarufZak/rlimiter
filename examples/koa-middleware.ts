import Koa from 'koa';
import { createClient } from 'redis';
import { koaRateLimiterMiddleware } from '@marufzak/rlimiter/adapters/koa';
import {
  FixedWindow,
  TokenBucket,
  LeakyBucket,
  SlidingWindowLog,
  SlidingWindowCount,
} from '@marufzak/rlimiter';

const redisClient = createClient();
await redisClient.connect();

const app = new Koa();

// Fixed Window
const fixedWindow = new FixedWindow({
  maxTokens: 100,
  windowSizeMs: 60_000,
  redisClient,
});

app.use(
  koaRateLimiterMiddleware({
    strategy: fixedWindow,
    getKey: ctx => ({ key: ctx.state.user?.id || ctx.ip }),
  })
);

// Token Bucket
const tokenBucket = new TokenBucket({
  capacity: 100,
  replenishRate: 10,
  redisClient,
});

app.use(
  koaRateLimiterMiddleware({
    strategy: tokenBucket,
    getKey: ctx => {
      const id = ctx.state.user?.id || ctx.ip;
      return {
        bucketKey: `bucket:${id}`,
        timestampKey: `timestamp:${id}`,
      };
    },
  })
);

// Leaky Bucket
const leakyBucket = new LeakyBucket({
  capacity: 100,
  leakRate: 10,
  redisClient,
});

app.use(
  koaRateLimiterMiddleware({
    strategy: leakyBucket,
    getKey: ctx => {
      const id = ctx.state.user?.id || ctx.ip;
      return {
        queueKey: `queue:${id}`,
        timestampKey: `timestamp:${id}`,
      };
    },
  })
);

// Sliding Window Log
const slidingWindowLog = new SlidingWindowLog({
  capacity: 100,
  windowMs: 60_000,
  redisClient,
});

app.use(
  koaRateLimiterMiddleware({
    strategy: slidingWindowLog,
    getKey: ctx => ({
      queueKey: `sliding:${ctx.state.user?.id || ctx.ip}`,
    }),
  })
);

// Sliding Window Count (requires Redis 7.4+)
const slidingWindowCount = new SlidingWindowCount({
  limit: 100,
  windowSizeMs: 60_000,
  subWindowSizeMs: 10_000,
  redisClient,
});

app.use(
  koaRateLimiterMiddleware({
    strategy: slidingWindowCount,
    getKey: ctx => ({
      hashKey: `swc:${ctx.state.user?.id || ctx.ip}`,
    }),
  })
);
