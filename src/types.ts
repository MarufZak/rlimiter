import type { RedisClientType } from 'redis';
import type { FixedWindowStrategy } from './strategies/fixed-window.js';

// eslint-disable-next-line
export type TRedisClient = RedisClientType<any, any, any, any>;

export type TStrategyResult = Promise<{
  isAllowed: boolean;
  remainingRequests: number;
  remainingTime: number;
}>;

export interface TStrategyCommonOpts {
  redisClient: TRedisClient;
  onError?: (error: unknown) => 'allow' | 'reject';
}

export type TStrategy = FixedWindowStrategy;
