# @marufzak/rlimiter

Redis-backed rate limiter for Node.js with pluggable strategies.

## Installation

```bash
npm install @marufzak/rlimiter redis
```

## Usage

### Basic

```typescript
import { createClient } from 'redis';
import RateLimiter from '@marufzak/rlimiter';
import { FixedWindowStrategy } from '@marufzak/rlimiter/strategies';

const redisClient = createClient();
await redisClient.connect();

const limiter = new RateLimiter({
  maxTokens: 10,
  refillMs: 60000,
  redisClient,
  strategy: new FixedWindowStrategy(),
});

const { isAllowed, remainingRequests, remainingTime } =
  await limiter.check('user-123');
if (!isAllowed) {
  console.log('Rate limit exceeded');
}
```

### Koa Middleware

```typescript
import Koa from 'koa';
import { koaRateLimiterMiddleware } from '@marufzak/rlimiter/adapters/koa';
import { FixedWindowStrategy } from '@marufzak/rlimiter/strategies';

const app = new Koa();

app.use(
  koaRateLimiterMiddleware({
    redisClient,
    strategy: new FixedWindowStrategy(),
    getKey: ctx => ctx.state.user?.id || ctx.ip,
  })
);
```

### Error Handling

By default, requests are rejected when Redis fails. You can customize this behavior:

```typescript
const limiter = new RateLimiter({
  maxTokens: 10,
  refillMs: 60000,
  redisClient,
  strategy: new FixedWindowStrategy(),
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

### RateLimiter(options)

**Options:**

- `maxTokens` - Maximum number of requests allowed per window
- `refillMs` - Window duration in milliseconds
- `redisClient` - Redis client instance
- `strategy` - Rate limiting strategy (e.g., `FixedWindowStrategy`)
- `onError` - Optional error handler that returns `'allow'` or `'reject'` (default: rejects)

**Methods:**

- `check(key: string)` - Returns object:
  - `isAllowed` - `true` if allowed, `false` if rate limited
  - `remainingRequests` - Number of remaining requests in current window
  - `remainingTime` - Time in milliseconds until window resets

### koaRateLimiterMiddleware(options)

**Options:**

- `redisClient` - Redis client instance
- `strategy` - Rate limiting strategy (e.g., `FixedWindowStrategy`)
- `getKey` - Function to extract rate limit key from context
- `onError` - Optional error handler that returns `'allow'` or `'reject'`
- `onLimit` - Optional callback `(key: string) => void` when rate limit exceeded
- `onProceed` - Optional callback `(key: string) => void` when request allowed

Returns 429 status with `X-Ratelimit-Retry-After` header (seconds) when rate limited.

## Strategies

### FixedWindowStrategy

Fixed window counter algorithm. Allows N requests per time window.

```typescript
import { FixedWindowStrategy } from '@marufzak/rlimiter/strategies';

const strategy = new FixedWindowStrategy();
```

**Behavior:**

- Starts with maxTokens available
- Each request decrements the counter
- Counter resets completely after refillMs

## License

MIT
