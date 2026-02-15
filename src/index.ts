import type { RedisClientType } from 'redis';

// eslint-disable-next-line
type TRedisClient = RedisClientType<any, any, any, any>;

export interface TStrategy {
  check: (opts: TStrategyOpts) => Promise<boolean>;
}

interface RateLimiterCommonOpts {
  maxTokens: number;
  refillSeconds: number;
  redisClient: TRedisClient;
}

export interface TStrategyOpts extends RateLimiterCommonOpts {
  key: string;
}

export interface RateLimiterOpts extends RateLimiterCommonOpts {
  strategy: TStrategy;
}

class RateLimiter {
  private maxTokens = 0;
  private refillSeconds = 0;
  private redisClient: TRedisClient;
  private strategy: TStrategy;

  constructor({
    maxTokens,
    refillSeconds,
    redisClient,
    strategy,
  }: RateLimiterOpts) {
    this.maxTokens = maxTokens;
    this.refillSeconds = refillSeconds;
    this.redisClient = redisClient;
    this.strategy = strategy;
  }

  async check(key: string) {
    return this.strategy.check({
      key,
      maxTokens: this.maxTokens,
      redisClient: this.redisClient,
      refillSeconds: this.refillSeconds,
    });
  }
}

export default RateLimiter;
