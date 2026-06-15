import { Queue, QueueOptions } from 'bullmq';
import { redisConfig } from '../config/redis.js';

const sharedQueueOptions: Omit<QueueOptions, 'connection'> = {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: false, // Keep failed jobs so we can inspect them before moving to DLQ or if they natively fail
  },
};

// Main Queues
export const intelligenceQueue = new Queue('intelligence-queue', {
  connection: redisConfig,
  ...sharedQueueOptions,
});

export const websiteAuditQueue = new Queue('website-audit-queue', {
  connection: redisConfig,
  ...sharedQueueOptions,
});

export const aiInsightsQueue = new Queue('ai-insights-queue', {
  connection: redisConfig,
  ...sharedQueueOptions,
});

export const buyingSignalsQueue = new Queue('buying-signals-queue', {
  connection: redisConfig,
  ...sharedQueueOptions,
});

export const outreachQueue = new Queue('outreach-engine-queue', {
  connection: redisConfig,
  ...sharedQueueOptions,
});

// Dead Letter Queues (DLQs)
export const failedIntelligenceQueue = new Queue('failed-intelligence', {
  connection: redisConfig,
});

export const failedAuditQueue = new Queue('failed-audit', {
  connection: redisConfig,
});

export const failedInsightsQueue = new Queue('failed-insights', {
  connection: redisConfig,
});

export const failedBuyingSignalsQueue = new Queue('failed-buying-signals', {
  connection: redisConfig,
});

export const failedOutreachQueue = new Queue('failed-outreach', {
  connection: redisConfig,
});
