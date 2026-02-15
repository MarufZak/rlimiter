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
    const response = await redisClient.eval(
      `
        local countKey = KEYS[1]

        local maxTokens = tonumber(ARGV[1])
        local refillMs = tonumber(ARGV[2])

        local count = tonumber(redis.call("GET", countKey))
        local ttl = tonumber(redis.call("PTTL", countKey))

        if not count or math.max(0, ttl) < 0 then
          count = maxTokens
          redis.call("PSETEX", countKey, refillMs, maxTokens)
          ttl = refillMs
        end

        count = count - 1

        if count < 0 then
          return {0, count + 1, ttl}
        end

        redis.call("SET", countKey, count, "KEEPTTL")

        return {1, count, ttl}
      `,
      {
        keys: [key],
        arguments: [this.maxTokens.toString(), this.refillMs.toString()],
      }
    );

    if (!Array.isArray(response)) {
      throw new Error('Unexpected return value');
    }

    const [isAllowed, remainingRequests, remainingTime] = response;

    return {
      isAllowed: Boolean(isAllowed),
      remainingRequests: Number(remainingRequests),
      remainingTime: Number(remainingTime),
    };
  }
}
