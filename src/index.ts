import type { RedisClientType } from 'redis';
import type { TStrategy } from './strategies/index.js';

// eslint-disable-next-line
export type TRedisClient = RedisClientType<any, any, any, any>;

export interface RateLimiterOpts {
  redisClient: TRedisClient;
  onError?: (error: unknown) => 'allow' | 'reject';
  strategy: TStrategy;
}

class RateLimiter {
  private redisClient: RateLimiterOpts['redisClient'];
  private strategy: RateLimiterOpts['strategy'];
  private onError: RateLimiterOpts['onError'];

  constructor({ redisClient, strategy, onError }: RateLimiterOpts) {
    this.redisClient = redisClient;
    this.strategy = strategy;
    this.onError = onError;
  }

  async check(key: string) {
    try {
      return await this.strategy.check({
        key,
        redisClient: this.redisClient,
      });
    } catch (error: unknown) {
      const response = this.onError?.(error);
      return response === 'allow';
    }
  }
}

export default RateLimiter;
