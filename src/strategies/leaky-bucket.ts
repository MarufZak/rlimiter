import type { TStrategyCommonOpts, TStrategyResult } from '../types.js';

export interface LeakyBucketStrategyOpts extends TStrategyCommonOpts {
  capacity: number;
  leakRate: number;
}

export interface LeakyBucketStrategyCheckOpts {
  queueKey: string;
  timestampKey: string;
}

export class LeakyBucketStrategy {
  capacity: LeakyBucketStrategyOpts['capacity'];
  leakRate: LeakyBucketStrategyOpts['leakRate'];
  redisClient: LeakyBucketStrategyOpts['redisClient'];
  onError: LeakyBucketStrategyOpts['onError'];

  constructor({
    capacity,
    leakRate,
    redisClient,
    onError,
  }: LeakyBucketStrategyOpts) {
    this.capacity = capacity;
    this.leakRate = leakRate;
    this.redisClient = redisClient;
    this.onError = onError;
  }

  async check({
    queueKey,
    timestampKey,
  }: LeakyBucketStrategyCheckOpts): TStrategyResult {
    try {
      const response = await this.redisClient.eval(
        `
          local queueKey = KEYS[1]
          local timestampKey = KEYS[2]

          local capacity = tonumber(ARGV[1]) // 5
          local leakRate = tonumber(ARGV[2]) // 2
          local now = tonumber(ARGV[3]) // 1771303625977
          local requested = tonumber(ARGV[4]) // 1

          local queueSize = tonumber(redis.call("GET", queueKey))
          local timestamp = tonumber(redis.call("GET", timestampKey))

          if not queueSize then
              queueSize = 0
          end

          if not timestamp then
              timestamp = now
          end

          local elapsed = (now - timestamp) / 1000
          queueSize = math.max(0, queueSize - leakRate * elapsed) + requested

          if queueSize > capacity then
            local excessTokens = queueSize - capacity
            local remainingTime = (excessTokens / leakRate) * 1000

            return { false, 0, remainingTime }
          end

          redis.call("SET", queueKey, queueSize)
          redis.call("SET", timestampKey, now)

          local remainingRequests = math.max(0, capacity - queueSize)

          return { true, remainingRequests, 0 }
        `,
        {
          keys: [queueKey, timestampKey],
          arguments: [
            this.capacity.toString(),
            this.leakRate.toString(),
            new Date().getTime().toString(),
            '1',
          ],
        }
      );

      if (!Array.isArray(response)) {
        throw new Error('Unexpected response format');
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
