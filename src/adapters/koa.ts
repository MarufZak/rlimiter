import type { Context, Middleware } from 'koa';
import type { RateLimiterOpts } from '../index.js';
import RateLimiter from '../index.js';

export interface KoaRateLimiterMiddlewareOpts extends RateLimiterOpts {
  getKey: (ctx: Context) => string;
  onLimit?: (key: string) => void;
  onProceed?: (key: string) => void;
}

export const koaRateLimiterMiddleware = ({
  redisClient,
  getKey,
  onLimit,
  onProceed,
  strategy,
  onError,
}: KoaRateLimiterMiddlewareOpts): Middleware => {
  const limiter = new RateLimiter({
    redisClient,
    strategy,
    onError,
  });

  return async (ctx, next) => {
    const key = getKey(ctx);
    const { isAllowed, remaining, ttl } = await limiter.check(key);

    if (!isAllowed) {
      ctx.status = 429;
      onLimit?.(key);
      return;
    }

    onProceed?.(key);
    await next();
  };
};
