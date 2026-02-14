import type { RateLimiterOpts } from '..';
import type { Context, Middleware } from 'koa';
import RateLimiter from '..';

export interface KoaRateLimiterMiddlewareOpts extends RateLimiterOpts {
  getKey: (ctx: Context) => string;
  onLimit?: (key: string) => void;
  onProceed?: (key: string) => void;
}

export const koaRateLimiterMiddleware = ({
  maxTokens,
  refillSeconds,
  redisClient,
  getKey,
  onLimit,
  onProceed,
}: KoaRateLimiterMiddlewareOpts): Middleware => {
  const limiter = new RateLimiter({
    maxTokens,
    refillSeconds,
    redisClient,
  });

  return async (ctx, next) => {
    const key = getKey(ctx);
    const isAllowed = await limiter.check(key);

    if (!isAllowed) {
      ctx.status = 429;
      onLimit?.(key);
      return;
    }

    onProceed?.(key);
    await next();
  };
};
