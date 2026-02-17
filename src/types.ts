import type { RedisClientType } from 'redis';
import type {
  FixedWindowStrategy,
  FixedWindowStrategyCheckOpts,
} from './strategies/fixed-window.js';
import type {
  TokenBucketStrategy,
  TokenBucketStrategyCheckOpts,
} from './strategies/token-bucket.js';
import type {
  LeakyBucketStrategy,
  LeakyBucketStrategyCheckOpts,
} from './strategies/leaky-bucket.js';

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

export type TStrategy =
  | FixedWindowStrategy
  | TokenBucketStrategy
  | LeakyBucketStrategy;

export type TStrategyCheckOpts = FixedWindowStrategyCheckOpts &
  TokenBucketStrategyCheckOpts &
  LeakyBucketStrategyCheckOpts;
