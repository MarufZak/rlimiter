# @marufzak/rlimiter

Redis-backed rate limiter for Node.js using the fixed window counter algorithm.

## Installation

```bash
npm install @marufzak/rlimiter redis
```

## Usage

### Basic

```typescript
import { createClient } from 'redis';
import RateLimiter from '@marufzak/rlimiter';

const redisClient = createClient();
await redisClient.connect();

const limiter = new RateLimiter({
  maxTokens: 10,
  refillSeconds: 60,
  redisClient,
});

const allowed = await limiter.check('user-123');
if (!allowed) {
  console.log('Rate limit exceeded');
}
```

### Koa Middleware

```typescript
import Koa from 'koa';
import { koaRateLimiterMiddleware } from '@marufzak/rlimiter/adapters/koa';

const app = new Koa();

app.use(
  koaRateLimiterMiddleware({
    maxTokens: 100,
    refillSeconds: 60,
    redisClient,
    getKey: (ctx) => ctx.state.user?.id || ctx.ip,
  })
);
```

## API

### RateLimiter(options)

**Options:**
- `maxTokens` - Maximum number of requests allowed per window
- `refillSeconds` - Window duration in seconds
- `redisClient` - Redis client instance

**Methods:**
- `check(key: string)` - Returns `true` if allowed, `false` if rate limited

### koaRateLimiterMiddleware(options)

**Options:**
- All RateLimiter options plus:
- `getKey` - Function to extract rate limit key from context
- `onLimit` - Optional callback when rate limit exceeded
- `onProceed` - Optional callback when request allowed

Returns 429 status when rate limited.

## License

MIT
