interface TocketBucketOpts {
  maxTokens: number;
  refillRate: number;
}

type MapType = Map<
  string,
  {
    count: number;
    lastTimestamp: number;
  }
>;

class TokenBucket {
  maxTokens = 0;
  refillRate = 0;
  map: MapType = new Map();

  constructor({ maxTokens, refillRate }: TocketBucketOpts) {
    this.maxTokens = maxTokens;
    this.refillRate = refillRate;
  }

  consume(ip: string) {
    const item = this.map.get(ip);
    const currentTimestamp = new Date().getTime();

    if (!item) {
      this.map.set(ip, {
        count: 1,
        lastTimestamp: currentTimestamp,
      });

      return true;
    }

    const { count, lastTimestamp } = item;

    this.map.set(ip, {
      count: count + 1,
      lastTimestamp: currentTimestamp,
    });

    return count < this.maxTokens;
  }
}
