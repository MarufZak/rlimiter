import type { TStrategy, TStrategyOpts } from './index.js';

export interface FixedWindowStrategyOpts {
  maxTokens: number;
  refillMs: number;
}

export class FixedWindowStrategy implements TStrategy {
  private maxTokens: FixedWindowStrategyOpts['maxTokens'];
  private refillMs: FixedWindowStrategyOpts['refillMs'];

  constructor({ maxTokens, refillMs }: FixedWindowStrategyOpts) {
    this.maxTokens = maxTokens;
    this.refillMs = refillMs;
  }

  async check({ redisClient, key }: TStrategyOpts) {
    const response = Boolean(
      await redisClient.eval(
        `
          local countKey = KEYS[1]

          local maxTokens = tonumber(ARGV[1])
          local refillMs = tonumber(ARGV[2])

          local count = tonumber(redis.call("GET", countKey))

          if not count then
            count = maxTokens
            redis.call("PSETEX", countKey, refillMs, maxTokens)
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
          arguments: [this.maxTokens.toString(), this.refillMs.toString()],
        }
      )
    );

    return response;
  }
}
