import type { TRedisClient } from '../index.js';

export * from './fixed-window.js';

export interface TStrategyOpts {
  redisClient: TRedisClient;
  key: string;
}

export interface TStrategy {
  check: (opts: TStrategyOpts) => Promise<{
    isAllowed: boolean;
    remaining: number;
    ttl: number;
  }>;
}
