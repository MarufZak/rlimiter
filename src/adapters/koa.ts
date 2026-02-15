import type { Context, Middleware } from 'koa';
import type { TStrategy } from '../types.js';

export interface KoaRateLimiterMiddlewareOpts<T extends TStrategy> {
  getKey: (ctx: Context) => Parameters<T['check']>[0];
  onLimit?: (key: Parameters<T['check']>[0]) => void;
  onProceed?: (key: Parameters<T['check']>[0]) => void;
  strategy: T;
}

export const koaRateLimiterMiddleware = <T extends TStrategy>({
  getKey,
  onLimit,
  onProceed,
  strategy,
}: KoaRateLimiterMiddlewareOpts<T>): Middleware => {
  return async (ctx, next) => {
    const key = getKey(ctx);

    const { isAllowed, remainingRequests, remainingTime } =
      await strategy.check(key);

    if (!isAllowed) {
      ctx.status = 429;
      ctx.set('X-Ratelimit-Retry-After', (remainingTime / 1000).toString());
      onLimit?.(key);
      return;
    }

    ctx.set('X-Ratelimit-Remaining', remainingRequests.toString());
    onProceed?.(key);
    await next();
  };
};
