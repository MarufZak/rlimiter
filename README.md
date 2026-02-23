# @marufzak/rlimiter

Redis-backed rate limiter for Node.js with multiple rate limiting strategies.

## Installation

```bash
npm install @marufzak/rlimiter redis
```

## Usage

### Basic - Fixed Window

```typescript
import { createClient } from 'redis';
import { FixedWindow } from '@marufzak/rlimiter';

const redisClient = createClient();
await redisClient.connect();

const strategy = new FixedWindow({
  maxTokens: 10,
  refillMs: 60000,
  redisClient,
});

const { isAllowed, remainingRequests, remainingTime } = await strategy.check({
  key: 'user-123',
});

if (!isAllowed) {
  console.log('Rate limit exceeded');
}
```

### Basic - Token Bucket

```typescript
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
```

### Basic - Leaky Bucket

```typescript
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
```

### Basic - Sliding Window Log

```typescript
import { createClient } from 'redis';
import { SlidingWindowLog } from '@marufzak/rlimiter';

const redisClient = createClient();
await redisClient.connect();

const strategy = new SlidingWindowLog({
  capacity: 10,
  windowMs: 60000, // 60 second window
  redisClient,
});

const { isAllowed, remainingRequests, remainingTime } = await strategy.check({
  queueKey: 'sliding:user-123',
});

if (!isAllowed) {
  console.log('Rate limit exceeded');
}
```

### Basic - Sliding Window Count

> Requires Redis 7.4+ (uses `HPEXPIRE` for per-field hash expiration)

```typescript
import { createClient } from 'redis';
import { SlidingWindowCount } from '@marufzak/rlimiter';

const redisClient = createClient();
await redisClient.connect();

const strategy = new SlidingWindowCount({
  limit: 10,
  windowSizeMs: 60000, // 60 second window
  subWindowSizeMs: 10000, // 10 second sub-windows
  redisClient,
});

const { isAllowed, remainingRequests, remainingTime } = await strategy.check({
  hashKey: 'swc:user-123',
});

if (!isAllowed) {
  console.log('Rate limit exceeded');
}
```

### Koa Middleware - Fixed Window

```typescript
import Koa from 'koa';
import { koaRateLimiterMiddleware } from '@marufzak/rlimiter/adapters/koa';
import { FixedWindow } from '@marufzak/rlimiter';

const app = new Koa();

const strategy = new FixedWindow({
  maxTokens: 100,
  refillMs: 60000,
  redisClient,
});

app.use(
  koaRateLimiterMiddleware({
    strategy,
    getKey: ctx => ({ key: ctx.state.user?.id || ctx.ip }),
  })
);
```

### Koa Middleware - Token Bucket

```typescript
import Koa from 'koa';
import { koaRateLimiterMiddleware } from '@marufzak/rlimiter/adapters/koa';
import { TokenBucket } from '@marufzak/rlimiter';

const app = new Koa();

const strategy = new TokenBucket({
  capacity: 100,
  replenishRate: 10,
  redisClient,
});

app.use(
  koaRateLimiterMiddleware({
    strategy,
    getKey: ctx => {
      const id = ctx.state.user?.id || ctx.ip;
      return {
        bucketKey: `bucket:${id}`,
        timestampKey: `timestamp:${id}`,
      };
    },
  })
);
```

### Koa Middleware - Leaky Bucket

```typescript
import Koa from 'koa';
import { koaRateLimiterMiddleware } from '@marufzak/rlimiter/adapters/koa';
import { LeakyBucket } from '@marufzak/rlimiter';

const app = new Koa();

const strategy = new LeakyBucket({
  capacity: 100,
  leakRate: 10,
  redisClient,
});

app.use(
  koaRateLimiterMiddleware({
    strategy,
    getKey: ctx => {
      const id = ctx.state.user?.id || ctx.ip;
      return {
        queueKey: `queue:${id}`,
        timestampKey: `timestamp:${id}`,
      };
    },
  })
);
```

### Koa Middleware - Sliding Window Log

```typescript
import Koa from 'koa';
import { koaRateLimiterMiddleware } from '@marufzak/rlimiter/adapters/koa';
import { SlidingWindowLog } from '@marufzak/rlimiter';

const app = new Koa();

const strategy = new SlidingWindowLog({
  capacity: 100,
  windowMs: 60000,
  redisClient,
});

app.use(
  koaRateLimiterMiddleware({
    strategy,
    getKey: ctx => ({
      queueKey: `sliding:${ctx.state.user?.id || ctx.ip}`,
    }),
  })
);
```

### Koa Middleware - Sliding Window Count

```typescript
import Koa from 'koa';
import { koaRateLimiterMiddleware } from '@marufzak/rlimiter/adapters/koa';
import { SlidingWindowCount } from '@marufzak/rlimiter';

const app = new Koa();

const strategy = new SlidingWindowCount({
  limit: 100,
  windowSizeMs: 60000,
  subWindowSizeMs: 10000,
  redisClient,
});

app.use(
  koaRateLimiterMiddleware({
    strategy,
    getKey: ctx => ({
      hashKey: `swc:${ctx.state.user?.id || ctx.ip}`,
    }),
  })
);
```

### Error Handling

By default, requests are rejected when Redis fails. You can customize this behavior:

```typescript
const strategy = new FixedWindow({
  maxTokens: 10,
  refillMs: 60000,
  redisClient,
  onError: error => {
    console.error('Rate limiter error:', error);
    return 'allow'; // or 'reject'
  },
});
```

**Default behavior:** Requests are rejected on Redis errors to maintain security.

**Fail open (allow requests):**

```typescript
onError: () => 'allow';
```

**Fail closed (reject requests):**

```typescript
onError: () => 'reject'; // Default
```

## API

### FixedWindow(options)

**Options:**

- `maxTokens` - Maximum number of requests allowed per window
- `refillMs` - Window duration in milliseconds
- `redisClient` - Redis client instance
- `onError` - Optional error handler that returns `'allow'` or `'reject'` (default: rejects)

**Methods:**

- `check({ key })` - Returns object:
  - `isAllowed` - `true` if allowed, `false` if rate limited
  - `remainingRequests` - Number of remaining requests in current window
  - `remainingTime` - Time in milliseconds until window resets

### TokenBucket(options)

**Options:**

- `capacity` - Maximum number of tokens in the bucket
- `replenishRate` - Tokens added per second
- `redisClient` - Redis client instance
- `onError` - Optional error handler that returns `'allow'` or `'reject'` (default: rejects)

**Methods:**

- `check({ bucketKey, timestampKey })` - Returns object:
  - `isAllowed` - `true` if allowed, `false` if rate limited
  - `remainingRequests` - Number of remaining tokens in bucket
  - `remainingTime` - Time in milliseconds until bucket refills

### LeakyBucket(options)

**Options:**

- `capacity` - Maximum queue size
- `leakRate` - Requests processed per second
- `redisClient` - Redis client instance
- `onError` - Optional error handler that returns `'allow'` or `'reject'` (default: rejects)

**Methods:**

- `check({ queueKey, timestampKey })` - Returns object:
  - `isAllowed` - `true` if allowed, `false` if rate limited
  - `remainingRequests` - Number of available slots in queue
  - `remainingTime` - Time in milliseconds until queue has capacity

### SlidingWindowCount(options)

> Requires Redis 7.4+

**Options:**

- `limit` - Maximum number of requests allowed per window
- `windowSizeMs` - Total window duration in milliseconds
- `subWindowSizeMs` - Sub-window duration in milliseconds
- `redisClient` - Redis client instance
- `onError` - Optional error handler that returns `'allow'` or `'reject'` (default: rejects)

**Methods:**

- `check({ hashKey })` - Returns object:
  - `isAllowed` - `true` if allowed, `false` if rate limited
  - `remainingRequests` - Number of remaining requests in the current window
  - `remainingTime` - Time in milliseconds until the next sub-window

### SlidingWindowLog(options)

**Options:**

- `capacity` - Maximum number of requests allowed per window
- `windowMs` - Sliding window duration in milliseconds
- `redisClient` - Redis client instance
- `onError` - Optional error handler that returns `'allow'` or `'reject'` (default: rejects)

**Methods:**

- `check({ queueKey })` - Returns object:
  - `isAllowed` - `true` if allowed, `false` if rate limited
  - `remainingRequests` - Number of remaining requests in the current window
  - `remainingTime` - Time in milliseconds until the earliest entry expires

### koaRateLimiterMiddleware(options)

**Options:**

- `strategy` - Rate limiting strategy instance (`FixedWindow`, `TokenBucket`, `LeakyBucket`, `SlidingWindowLog`, or `SlidingWindowCount`)
- `getKey` - Function to extract rate limit key(s) from context (returns strategy-specific check options)
- `onLimit` - Optional callback when rate limit exceeded
- `onProceed` - Optional callback when request allowed

Returns 429 status with `X-Ratelimit-Retry-After` header (seconds) and sets `X-Ratelimit-Remaining` header when rate limited.

## License

MIT
