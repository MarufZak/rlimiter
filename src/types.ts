import type { RedisClientType } from 'redis';
import type {
  FixedWindow,
  FixedWindowCheckOpts,
} from './strategies/fixed-window.js';
import type {
  TokenBucket,
  TokenBucketCheckOpts,
} from './strategies/token-bucket.js';
import type {
  LeakyBucket,
  LeakyBucketCheckOpts,
} from './strategies/leaky-bucket.js';
import type {
  SlidingWindowLog,
  SlidingWindowLogCheckOpts,
} from './strategies/sliding-window-log.js';
import type {
  SlidingWindowCheckOpts,
  SlidingWindowCount,
} from './strategies/sliding-window-count.js';

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
  | FixedWindow
  | TokenBucket
  | LeakyBucket
  | SlidingWindowLog
  | SlidingWindowCount;

export type TStrategyCheckOpts = FixedWindowCheckOpts &
  TokenBucketCheckOpts &
  LeakyBucketCheckOpts &
  SlidingWindowLogCheckOpts &
  SlidingWindowCheckOpts;
