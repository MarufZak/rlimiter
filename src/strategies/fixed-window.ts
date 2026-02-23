import { RLimiterError } from '../errors.js';
import type { TStrategyCommonOpts, TStrategyResult } from '../types.js';

export interface FixedWindowOpts extends TStrategyCommonOpts {
  maxTokens: number;
  windowSizeMs: number;
}

export interface FixedWindowCheckOpts {
  key: string;
}

export class FixedWindow {
  private redisClient: FixedWindowOpts['redisClient'];
  private onError: FixedWindowOpts['onError'];
  private maxTokens: FixedWindowOpts['maxTokens'];
  private windowSizeMs: FixedWindowOpts['windowSizeMs'];

  constructor({
    maxTokens,
    windowSizeMs,
    redisClient,
    onError,
  }: FixedWindowOpts) {
    if (maxTokens <= 0) {
      throw new RLimiterError('maxTokens should be greater than 0');
    }

    if (windowSizeMs <= 0) {
      throw new RLimiterError('windowSizeMs should be greater than 0');
    }

    this.redisClient = redisClient;
    this.onError = onError;
    this.maxTokens = maxTokens;
    this.windowSizeMs = windowSizeMs;
  }

  async check({ key }: FixedWindowCheckOpts): TStrategyResult {
    try {
      const response = await this.redisClient.eval(
        `
          local countKey = KEYS[1]

          local maxTokens = tonumber(ARGV[1])
          local windowSizeMs = tonumber(ARGV[2])

          local count = tonumber(redis.call("GET", countKey))
          local ttl = tonumber(redis.call("PTTL", countKey))

          if not count or ttl < 0 then
            local tokensLeft = maxTokens - 1
            redis.call("PSETEX", countKey, windowSizeMs, tokensLeft)

            return { true, tokensLeft, 0 }
          end

          count = count - 1

          if count < 0 then
            return { false, 0, ttl }
          end

          redis.call("SET", countKey, count, "KEEPTTL")

          return { true, count, 0 }
        `,
        {
          keys: [key],
          arguments: [this.maxTokens.toString(), this.windowSizeMs.toString()],
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
