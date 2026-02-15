import type { RateLimiterCommonOpts } from '../index.js';

export interface TStrategyOpts extends RateLimiterCommonOpts {
  key: string;
}

export interface TStrategy {
  check: (opts: TStrategyOpts) => Promise<boolean>;
}
