import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

@Injectable()
export class CartCacheService {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  async get(key: string) {
    const value = await this.redis.get(key);
    return value ? JSON.parse(value) : null;
  }

async set(key: string, value: any, ttlMs?: number) {
  const serialized = JSON.stringify(value);

  // CASE 1: NO TTL (PERMANENT KEY - like version)
  if (!ttlMs) {
    await this.redis.set(key, serialized);
    return;
  }

  // CASE 2: TTL CACHE
  await this.redis.set(key, serialized, 'PX', ttlMs);
}

  async delete(key: string) {
    await this.redis.del(key);
  }

  async clearPattern(pattern: string) {
    const keys = await this.redis.keys(pattern);
    if (keys.length) {
      await this.redis.del(...keys);
    }
  }
}