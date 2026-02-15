import type { TStrategyCommonOpts, TStrategyResult } from '../types.js';

export interface FixedWindowStrategyOpts extends TStrategyCommonOpts {
  maxTokens: number;
  refillMs: number;
}

export interface FixedWindowStrategyCheckOpts {
  key: string;
}

export class FixedWindowStrategy {
  private redisClient: FixedWindowStrategyOpts['redisClient'];
  private onError: FixedWindowStrategyOpts['onError'];
  private maxTokens: FixedWindowStrategyOpts['maxTokens'];
  private refillMs: FixedWindowStrategyOpts['refillMs'];

  constructor({
    maxTokens,
    refillMs,
    redisClient,
    onError,
  }: FixedWindowStrategyOpts) {
    this.redisClient = redisClient;
    this.onError = onError;
    this.maxTokens = maxTokens;
    this.refillMs = refillMs;
  }

  async check({ key }: FixedWindowStrategyCheckOpts): TStrategyResult {
    try {
      const response = await this.redisClient.eval(
        `
          local countKey = KEYS[1]

          local maxTokens = tonumber(ARGV[1])
          local refillMs = tonumber(ARGV[2])

          local count = tonumber(redis.call("GET", countKey))
          local ttl = tonumber(redis.call("PTTL", countKey))

          if not count or ttl < 0 then
            redis.call("PSETEX", countKey, refillMs, maxTokens - 1)
            return {1, maxTokens - 1, refillMs}
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
