import { RLimiterError } from '../errors.js';
import type { TStrategyCommonOpts, TStrategyResult } from '../types.js';

export interface SlidingWindowCountOpts extends TStrategyCommonOpts {
  windowSizeMs: number;
  subWindowSizeMs: number;
  limit: number;
}

export interface SlidingWindowCheckOpts {
  hashKey: string;
}

export class SlidingWindowCount {
  redisClient: SlidingWindowCountOpts['redisClient'];
  onError: SlidingWindowCountOpts['onError'];
  windowSizeMs: SlidingWindowCountOpts['windowSizeMs'];
  subWindowSizeMs: SlidingWindowCountOpts['subWindowSizeMs'];
  limit: SlidingWindowCountOpts['limit'];

  constructor({
    redisClient,
    onError,
    windowSizeMs,
    subWindowSizeMs,
    limit,
  }: SlidingWindowCountOpts) {
    if (windowSizeMs <= 0) {
      throw new RLimiterError('windowSizeMs should be greater than 0');
    }

    if (subWindowSizeMs <= 0) {
      throw new RLimiterError('subWindowSizeMs should be greater than 0');
    }

    if (limit <= 0) {
      throw new RLimiterError('limit should be greater than 0');
    }

    this.redisClient = redisClient;
    this.onError = onError;
    this.windowSizeMs = windowSizeMs;
    this.subWindowSizeMs = subWindowSizeMs;
    this.limit = limit;
  }

  async check({ hashKey }: SlidingWindowCheckOpts): TStrategyResult {
    try {
      const response = await this.redisClient.eval(
        `
          local hashKey = KEYS[1]

          local windowSizeMs = tonumber(ARGV[1])
          local subWindowSizeMs = tonumber(ARGV[2])
          local limit = tonumber(ARGV[3])

          local time = redis.call("TIME")
          local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)

          local values = redis.call("HVALS", hashKey)
          local sum = 0

          for i = 1, #values, 1 do
              sum = sum + values[i]
          end

          if sum >= limit then
            return { false, 0, subWindowSizeMs }
          end

          local currentSubWindow = tostring(math.floor(now / subWindowSizeMs))
          redis.call("HINCRBY", hashKey, currentSubWindow, 1)
          redis.call("HEXPIRE", hashKey, math.ceil(windowSizeMs / 1000), "NX", "FIELDS", "1", currentSubWindow)

          local remainingRequests = limit - sum - 1

          return { true, remainingRequests, 0 }
        `,
        {
          keys: [hashKey],
          arguments: [
            this.windowSizeMs.toString(),
            this.subWindowSizeMs.toString(),
            this.limit.toString(),
          ],
        }
      );

      if (!Array.isArray(response)) {
        throw new RLimiterError('Unexpected response format');
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
