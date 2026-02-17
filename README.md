# @marufzak/rlimiter

Redis-backed rate limiter for Node.js with pluggable strategies.

## Installation

```bash
npm install @marufzak/rlimiter redis
```

## Usage

### Basic - Fixed Window

```typescript
import { createClient } from 'redis';
import { FixedWindow } from '@marufzak/rlimiter/strategies';

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
import { TokenBucket } from '@marufzak/rlimiter/strategies';

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

### Koa Middleware - Fixed Window

```typescript
import Koa from 'koa';
import { koaRateLimiterMiddleware } from '@marufzak/rlimiter/adapters/koa';
import { FixedWindow } from '@marufzak/rlimiter/strategies';

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
import { TokenBucket } from '@marufzak/rlimiter/strategies';

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
  - `remainingTime` - Time in milliseconds until bucket refills (placeholder)

### koaRateLimiterMiddleware(options)

**Options:**

- `strategy` - Rate limiting strategy instance (e.g., `FixedWindow` or `TokenBucket`)
- `getKey` - Function to extract rate limit key(s) from context (returns strategy-specific check options)
- `onLimit` - Optional callback when rate limit exceeded
- `onProceed` - Optional callback when request allowed

Returns 429 status with `X-Ratelimit-Retry-After` header (seconds) and sets `X-Ratelimit-Remaining` header when rate limited.

## Strategies

### FixedWindow

```typescript
import { FixedWindow } from '@marufzak/rlimiter/strategies';

const strategy = new FixedWindow({
  maxTokens: 100,
  refillMs: 60000,
  redisClient,
});
```

### TokenBucket

```typescript
import { TokenBucket } from '@marufzak/rlimiter/strategies';

const strategy = new TokenBucket({
  capacity: 100,
  replenishRate: 10, // 10 tokens per second
  redisClient,
});
```

## License

MIT
