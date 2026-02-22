import { RLimiterError } from '../errors.js';
import type { TStrategyCommonOpts, TStrategyResult } from '../types.js';

export interface SlidingWindowLogOpts extends TStrategyCommonOpts {
  capacity: number;
  windowMs: number;
}

export interface SlidingWindowLogCheckOpts {
  queueKey: string;
}

export class SlidingWindowLog {
  capacity: SlidingWindowLogOpts['capacity'];
  redisClient: SlidingWindowLogOpts['redisClient'];
  onError: SlidingWindowLogOpts['onError'];
  windowMs: SlidingWindowLogOpts['windowMs'];

  constructor({
    capacity,
    windowMs,
    redisClient,
    onError,
  }: SlidingWindowLogOpts) {
    if (capacity <= 0) {
      throw new RLimiterError('capacity should be greater than 0');
    }

    if (windowMs <= 0) {
      throw new RLimiterError('windowMs should be greater than 0');
    }

    this.capacity = capacity;
    this.redisClient = redisClient;
    this.onError = onError;
    this.windowMs = windowMs;
  }

  async check({ queueKey }: SlidingWindowLogCheckOpts): TStrategyResult {
    try {
      const response = await this.redisClient.eval(
        `
          local queueKey = KEYS[1]

          local capacity = tonumber(ARGV[1])
          local windowMs = tonumber(ARGV[2])

          local time = redis.call("TIME")

          -- in lua doubles has 15 digits, which truncates microseconds to 3 digits
          -- removing first 3 digits of seconds in favor of microsecond precision
          local seconds = tonumber(string.sub(tostring(time[1]), 3))

          local windowEnd = tonumber(seconds .. "." .. time[2])
          local windowStart = windowEnd - (windowMs / 1000)

          redis.call("ZREMRANGEBYSCORE", queueKey, "-inf", windowStart)
          local members = redis.call("ZRANGE", queueKey, 0, -1)

          if #members >= capacity then
            local remainingTime = (tonumber(members[1]) - windowStart) * 1000

            return { false, 0, remainingTime, tostring(windowEnd) }
          end

          table.insert(members, tostring(windowEnd))
          redis.call("ZADD", queueKey, windowEnd, windowEnd)

          local requestsRemaining = capacity - #members

          return { true, requestsRemaining, 0, tostring(windowEnd) }
        `,
        {
          keys: [queueKey],
          arguments: [this.capacity.toString(), this.windowMs.toString()],
        }
      );

      if (!Array.isArray(response)) {
        throw new RLimiterError('Unexpected response format');
      }

      const [isAllowed, remainingRequests, remainingTime, windowEnd] = response;

      console.log({ windowEnd });

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
