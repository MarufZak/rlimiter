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
          local nonce = ARGV[3]

          local time = redis.call("TIME")
          local windowEnd = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
          local windowStart = windowEnd - windowMs

          redis.call("ZREMRANGEBYSCORE", queueKey, "-inf", windowStart)
          local members = redis.call("ZRANGE", queueKey, 0, -1)

          if #members >= capacity then
            local firstScore = tonumber(redis.call("ZSCORE", queueKey, members[1]))
            local remainingTime = (firstScore - windowStart) * 1000

            return { false, 0, remainingTime }
          end

          table.insert(members, nonce)
          redis.call("ZADD", queueKey, windowEnd, nonce)

          local requestsRemaining = capacity - #members

          return { true, requestsRemaining, 0 }
        `,
        {
          keys: [queueKey],
          arguments: [
            this.capacity.toString(),
            this.windowMs.toString(),
            crypto.randomUUID(),
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
