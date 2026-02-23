# @marufzak/rlimiter

Redis-backed rate limiter for Node.js with multiple rate limiting strategies.

## Installation

```bash
npm install @marufzak/rlimiter redis
```

## Usage

See the [examples](./examples) folder for usage examples:

- [Fixed Window](./examples/fixed-window.ts)
- [Token Bucket](./examples/token-bucket.ts)
- [Leaky Bucket](./examples/leaky-bucket.ts)
- [Sliding Window Log](./examples/sliding-window-log.ts)
- [Sliding Window Count](./examples/sliding-window-count.ts) (requires Redis 7.4+)
- [Koa Middleware](./examples/koa-middleware.ts)

### Error Handling

By default, requests are rejected when Redis fails. You can customize this behavior:

```typescript
const strategy = new FixedWindow({
  maxTokens: 10,
  windowSizeMs: 60000,
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
- `windowSizeMs` - Window duration in milliseconds
- `redisClient` - Redis client instance
- `onError` - Optional error handler that returns `'allow'` or `'reject'` (default: rejects)

**Methods:**

- `check({ key })` - Returns object:
  - `isAllowed` - `true` if allowed, `false` if rate limited
  - `remainingRequests` - Number of remaining requests in current window
  - `remainingTime` - Time in milliseconds until retry is possible

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
  - `remainingTime` - Time in milliseconds until retry is possible

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
  - `remainingTime` - Time in milliseconds until retry is possible

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
  - `remainingTime` - Time in milliseconds until retry is possible

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
  - `remainingTime` - Time in milliseconds until retry is possible

### koaRateLimiterMiddleware(options)

**Options:**

- `strategy` - Rate limiting strategy instance (`FixedWindow`, `TokenBucket`, `LeakyBucket`, `SlidingWindowLog`, or `SlidingWindowCount`)
- `getKey` - Function to extract rate limit key(s) from context (returns strategy-specific check options)
- `onLimit` - Optional callback when rate limit exceeded
- `onProceed` - Optional callback when request allowed

Returns 429 status with `X-Ratelimit-Retry-After` header (seconds) and sets `X-Ratelimit-Remaining` header when rate limited.

## License

MIT
