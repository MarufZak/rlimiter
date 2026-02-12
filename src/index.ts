import type { RedisClientType } from 'redis';

interface RateLimiterOpts {
  maxTokens: number;
  refillSeconds: number;
  redisClient: RedisClientType;
}

class RateLimiter {
  maxTokens = 0;
  refillSeconds = 0;
  redisClient: RedisClientType;

  constructor({ maxTokens, refillSeconds, redisClient }: RateLimiterOpts) {
    this.maxTokens = maxTokens;
    this.refillSeconds = refillSeconds;
    this.redisClient = redisClient;
  }

  async check(key: string) {
    const response = Boolean(
      await this.redisClient.evalSha(
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
