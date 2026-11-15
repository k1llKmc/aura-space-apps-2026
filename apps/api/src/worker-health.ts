import Redis from 'ioredis';
import { hostname } from 'node:os';
import { queuePrefix, redisOptions } from './modules/tasks/redis.config';
const redis = new Redis(redisOptions());
redis.on('error', () => {});
void new Promise<void>((resolve, reject) => { redis.once('ready', resolve); redis.once('error', reject); })
  .then(() => redis.get(`${queuePrefix()}:worker:${hostname()}`)).then((value) => { process.exitCode = value && Date.now() - Number(value) < 15000 ? 0 : 1; })
  .catch(() => { process.exitCode = 1; }).finally(() => redis.disconnect());
