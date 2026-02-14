import type { RedisClientType } from 'redis';

// eslint-disable-next-line
type TRedisClient = RedisClientType<any, any, any, any>;

export interface RateLimiterOpts {
  maxTokens: number;
  refillSeconds: number;
  redisClient: TRedisClient;
}

class RateLimiter {
  private maxTokens = 0;
  private refillSeconds = 0;
  private redisClient: TRedisClient;

  constructor({ maxTokens, refillSeconds, redisClient }: RateLimiterOpts) {
    this.maxTokens = maxTokens;
    this.refillSeconds = refillSeconds;
    this.redisClient = redisClient;
  }

  async check(key: string) {
    const response = Boolean(
      await this.redisClient.eval(
        `
          local countKey = KEYS[1]

          local maxTokens = tonumber(ARGV[1])
          local refillSeconds = tonumber(ARGV[2])

          local count = tonumber(redis.call("GET", countKey))

          if not count then
            count = maxTokens
            redis.call("SETEX", countKey, refillSeconds, maxTokens)
          end

          count = count - 1

          if count < 0 then
            return false
          end

          redis.call("SET", countKey, count, "KEEPTTL")

          return true
        `,
        {
          keys: [key],
          arguments: [this.maxTokens.toString(), this.refillSeconds.toString()],
        }
      )
    );

    return response;
  }
}

export default RateLimiter;
