import type { RedisClientType } from 'redis';
import type { TStrategy } from './strategies/index.js';

// eslint-disable-next-line
type TRedisClient = RedisClientType<any, any, any, any>;

export interface RateLimiterCommonOpts {
  maxTokens: number;
  refillSeconds: number;
  redisClient: TRedisClient;
  onError?: (error: unknown) => 'allow' | 'reject';
}

export interface RateLimiterOpts extends RateLimiterCommonOpts {
  strategy: TStrategy;
}

class RateLimiter {
  private maxTokens = 0;
  private refillSeconds = 0;
  private redisClient: RateLimiterOpts['redisClient'];
  private strategy: RateLimiterOpts['strategy'];
  private onError: RateLimiterOpts['onError'];

  constructor({
    maxTokens,
    refillSeconds,
    redisClient,
    strategy,
    onError,
  }: RateLimiterOpts) {
    this.maxTokens = maxTokens;
    this.refillSeconds = refillSeconds;
    this.redisClient = redisClient;
    this.strategy = strategy;
    this.onError = onError;
  }

  async check(key: string) {
    try {
      return await this.strategy.check({
        key,
        maxTokens: this.maxTokens,
        redisClient: this.redisClient,
        refillSeconds: this.refillSeconds,
      });
    } catch (error: unknown) {
      console.log({ error });

      const response = this.onError?.(error);
      return response === 'allow';
    }
  }
}

export default RateLimiter;
