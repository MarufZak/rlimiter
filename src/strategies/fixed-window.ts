import type { TRedisClient } from '../index.js';
import type { TStrategy, TStrategyOpts } from './index.js';

export interface FixedWindowStrategyOpts {
  maxTokens: number;
  refillSeconds: number;
}

export class FixedWindowStrategy implements TStrategy {
  private maxTokens: FixedWindowStrategyOpts['maxTokens'];
  private refillSeconds: FixedWindowStrategyOpts['refillSeconds'];

  constructor({ maxTokens, refillSeconds }: FixedWindowStrategyOpts) {
    this.maxTokens = maxTokens;
    this.refillSeconds = refillSeconds;
  }

  async check({ redisClient, key }: TStrategyOpts) {
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
          arguments: [this.maxTokens.toString(), this.refillSeconds.toString()],
        }
      )
    );

    return response;
  }
}
