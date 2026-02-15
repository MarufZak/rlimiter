import Koa from 'koa';
import supertest from 'supertest';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';
import type { Server } from 'http';
import type TestAgent from 'supertest/lib/agent';
import { koaRateLimiterMiddleware } from '../../src/adapters/koa';
import { redisClient } from '../hooks/redis';
import { FixedWindowStrategy } from '../../src/strategies/fixed-window';

let app: Server;
let request: TestAgent;
let limitCb: Mock;
let proceedCb: Mock;

beforeAll(() => {
  limitCb = vi.fn();
  proceedCb = vi.fn();
});

beforeAll(() => {
  const koaApp = new Koa();

  koaApp.use(
    koaRateLimiterMiddleware({
      getKey: ctx => ctx.get('x-key'),
      redisClient,
      onLimit: limitCb,
      onProceed: proceedCb,
      strategy: new FixedWindowStrategy({
        maxTokens: 3,
        refillSeconds: 1,
      }),
    })
  );
  koaApp.use(ctx => {
    ctx.status = 200;
  });

  app = koaApp.listen(3000, () => {
    console.log('App listening on port 3000');
  });

  request = supertest(app);
});

beforeEach(() => {
  vi.clearAllMocks();
});

afterAll(() => {
  app.close(err => {
    if (err) {
      console.log('Error while closing server', err);
    } else {
      console.log('Server closed successfully');
    }
  });
});

describe('koa', () => {
  it('works correctly', async () => {
    const key1 = `user-1`;
    const key2 = `user-2`;

    await Promise.all([
      request.get('/').set('x-key', key1).expect(200),
      request.get('/').set('x-key', key1).expect(200),
      request.get('/').set('x-key', key1).expect(200),
    ]);

    await request.get('/').set('x-key', key1).expect(429);

    await request.get('/').set('x-key', key2).expect(200);
  });

  it('callbacks are invoked', async () => {
    const key = `user-1`;

    await Promise.all([
      request.get('/').set('x-key', key).expect(200),
      request.get('/').set('x-key', key).expect(200),
      request.get('/').set('x-key', key).expect(200),
    ]);

    await request.get('/').set('x-key', key).expect(429);

    expect(proceedCb).toBeCalledTimes(3);
    expect(limitCb).toBeCalledTimes(1);
  });
});
