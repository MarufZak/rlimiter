import { RedisContainer } from '@testcontainers/redis';
import { createClient, type RedisClientType } from 'redis';

export const wait = (ms: number) => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(null);
    }, ms);
  });
};

const MAX_RETRIES = 5;
const RETRY_INTERVAL_MS = 1_000;

export const createRedisClient = async () => {
  const container = await new RedisContainer('redis').start();

  const client: RedisClientType = createClient({
    url: container.getConnectionUrl(),
  });

  let retriesLeft = MAX_RETRIES;

  while (retriesLeft > 0) {
    try {
      await client.connect();
      break;
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === 'ECONNREFUSED'
      ) {
        await wait(RETRY_INTERVAL_MS);
        client.destroy();
        retriesLeft--;
      }
    }
  }

  return { client };
};
