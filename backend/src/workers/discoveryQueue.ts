import { Queue } from 'bullmq';
import { redisConfig } from '../config/redis.js';

export const DISCOVERY_QUEUE_NAME = 'discovery-queue';

export const discoveryQueue = new Queue(DISCOVERY_QUEUE_NAME, {
  connection: redisConfig,
});
