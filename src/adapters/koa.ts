import type { RateLimiterOpts } from '..';
import type { Context, Middleware } from 'koa';
import RateLimiter from '..';

export interface KoaRateLimiterMiddlewareOpts extends RateLimiterOpts {
  getKey: (ctx: Context) => string;
}

export const koaRateLimiterMiddleware = ({
  maxTokens,
  refillSeconds,
  redisClient,
  getKey,
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
      return;
    }

    await next();
  };
};
