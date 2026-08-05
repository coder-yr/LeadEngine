import { RedisOptions } from 'bullmq';

const url = process.env.REDIS_URL ? new URL(process.env.REDIS_URL) : null;

export const redisConfig: RedisOptions = {
  host: url?.hostname || process.env.REDIS_HOST || process.env.REDISHOST || 'localhost',
  port: url?.port ? parseInt(url.port, 10) : parseInt(process.env.REDIS_PORT || process.env.REDISPORT || '6379', 10),
  password: url?.password || process.env.REDIS_PASSWORD || process.env.REDISPASSWORD || undefined,
  username: url?.username || process.env.REDIS_USER || process.env.REDISUSER || undefined,
  maxRetriesPerRequest: null,
};
