import type { TStrategyCommonOpts, TStrategyResult } from '../types.js';

export interface TokenBucketOpts extends TStrategyCommonOpts {
  replenishRate: number;
  capacity: number;
}

export interface TokenBucketCheckOpts {
  bucketKey: string;
  timestampKey: string;
}

export class TokenBucket {
  redisClient: TokenBucketOpts['redisClient'];
  onError: TokenBucketOpts['onError'];
  replenishRate: TokenBucketOpts['replenishRate'];
  capacity: TokenBucketOpts['capacity'];

  constructor({
    redisClient,
    onError,
    replenishRate,
    capacity,
  }: TokenBucketOpts) {
    this.redisClient = redisClient;
    this.onError = onError;
    this.replenishRate = replenishRate;
    this.capacity = capacity;
  }

  async check({
    bucketKey,
    timestampKey,
  }: TokenBucketCheckOpts): TStrategyResult {
    try {
      const response = await this.redisClient.eval(
        `
          local bucketKey = KEYS[1]
          local timestampKey = KEYS[2]

          local capacity = tonumber(ARGV[1])
          local rate = tonumber(ARGV[2])
          local now = tonumber(ARGV[3])
          local requested = tonumber(ARGV[4])

          local fillTime = capacity / rate
          local ttl = math.floor(fillTime * 2)

          local currentTokens = tonumber(redis.call("GET", bucketKey))
          local lastAccessTime = tonumber(redis.call("GET", timestampKey))

          if not currentTokens then
            currentTokens = capacity
          end

          if not lastAccessTime then
            lastAccessTime = 0
          end

          local delta = now - lastAccessTime
          local refillTokens = currentTokens + (rate * delta)
          refillTokens = math.min(capacity, refillTokens)

          local newTokens = refillTokens - requested
          local isAllowed = 0
          local remainingTime = 0

          if newTokens >= 0 then
            isAllowed = 1
          end

          if newTokens < requested then
            remainingTime = math.ceil((requested - newTokens) / rate * 1000)
          end

          newTokens = math.max(0, newTokens)

          if isAllowed == 1 then
            redis.call("SETEX", bucketKey, ttl, newTokens)
            redis.call("SETEX", timestampKey, ttl, now)
          end

          return { isAllowed, newTokens, remainingTime }
        `,
        {
          keys: [bucketKey, timestampKey],
          arguments: [
            this.capacity.toString(),
            this.replenishRate.toString(),
            Math.floor(Date.now() / 1000).toString(),
            '1',
          ],
        }
      );

      if (!Array.isArray(response)) {
        throw new Error('Unexpected response format');
      }

      const [isAllowed, remainingRequests, remainingTime] = response;

      return {
        isAllowed: Boolean(isAllowed),
        remainingRequests: Number(remainingRequests),
        remainingTime: Number(remainingTime),
      };
    } catch (error: unknown) {
      const response = this.onError?.(error);
      return {
        isAllowed: response === 'allow',
        remainingRequests: 0,
        remainingTime: 0,
      };
    }
  }
}
