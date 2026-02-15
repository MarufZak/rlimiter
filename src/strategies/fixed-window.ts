import type { TStrategy, TStrategyOpts } from './index.js';

export class FixedWindowStrategy implements TStrategy {
  async check({ key, redisClient, maxTokens, refillSeconds }: TStrategyOpts) {
    const response = Boolean(
      await redisClient.eval(
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
          arguments: [maxTokens.toString(), refillSeconds.toString()],
        }
      )
    );

    return response;
  }
}
