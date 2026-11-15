import type { RedisOptions } from 'ioredis';
export const queueName = 'background';
export function queuePrefix() { return process.env.QUEUE_PREFIX || 'aura'; }
export function redisOptions(worker = false): RedisOptions {
  const url = new URL(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
  if (!['redis:', 'rediss:'].includes(url.protocol)) throw new Error('REDIS_URL must use redis:// or rediss://.');
  const db = Number(url.pathname.slice(1) || 0);
  if (!Number.isInteger(db) || db < 0) throw new Error('Invalid Redis database number.');
  return { host: url.hostname, port: Number(url.port || 6379), db, username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined, ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
    connectTimeout: 2000, ...(worker ? {} : { commandTimeout: 2000 }), maxRetriesPerRequest: worker ? null : 1, enableOfflineQueue: worker,
    retryStrategy: (attempt) => Math.min(500 * attempt, 2000) };
}
