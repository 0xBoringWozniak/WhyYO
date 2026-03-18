import type Redis from "ioredis";

export const withRedisCache = async <T>({
  redis,
  key,
  ttlSec,
  load,
}: {
  redis: Redis;
  key: string;
  ttlSec: number;
  load: () => Promise<T>;
}): Promise<T> => {
  const cached = await redis.get(key);
  if (cached) {
    return JSON.parse(cached) as T;
  }
  const fresh = await load();
  await redis.set(key, JSON.stringify(fresh), "EX", ttlSec);
  return fresh;
};
