import Redis from "ioredis";

import { getEnv } from "../config/env";

let client: Redis | null = null;

export const getRedis = (): Redis => {
  if (!client) {
    client = new Redis(getEnv().REDIS_URL, {
      lazyConnect: false,
      maxRetriesPerRequest: 2,
    });
  }
  return client;
};
