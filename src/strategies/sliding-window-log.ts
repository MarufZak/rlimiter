import { RLimiterError } from '../errors.js';
import type { TStrategyCommonOpts, TStrategyResult } from '../types.js';

export interface SlidingWindowLogOpts extends TStrategyCommonOpts {
  capacity: number;
}

export interface SlidingWindowLogCheckOpts {
  queueKey: string;
}

export class SlidingWindowLog {
  capacity: SlidingWindowLogOpts['capacity'];
  redisClient: SlidingWindowLogOpts['redisClient'];
  onError: SlidingWindowLogOpts['onError'];

  constructor({ capacity, redisClient, onError }: SlidingWindowLogOpts) {
    this.capacity = capacity;
    this.redisClient = redisClient;
    this.onError = onError;
  }

  async check({ queueKey }: SlidingWindowLogCheckOpts): TStrategyResult {
    try {
      const response = await this.redisClient.eval(
        `
          local queueKey = KEYS[1]

          local capacity = tonumber(ARGV[1])

          local time = redis.call("TIME")
          local windowEnd = (tonumber(time[1]) * 1000) + math.floor(tonumber(time[2]) / 1000)
          local windowStart = windowEnd - 1000

          redis.call("ZREMRANGEBYSCORE", queueKey, -inf, windowStart)
          local members = redis.call("ZRANGE", queueKey, 0, -1)

          if #members >= capacity then
            local remainingTime = tonumber(members[1]) - windowStart

            return { false, 0, remainingTime }
          end

          table.insert(members, windowEnd)
          redis.call("ZADD", queueKey, windowEnd, windowEnd)

          local requestsRemaining = capacity - #members

          return { true, requestsRemaining, 0 }
        `,
        {
          keys: [queueKey],
          arguments: [this.capacity.toString()],
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
