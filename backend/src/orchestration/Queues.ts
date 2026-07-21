import { Queue, QueueOptions } from 'bullmq';
import { redisConfig } from '../config/redis.js';

const sharedQueueOptions: Omit<QueueOptions, 'connection'> = {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: { count: 100, age: 24 * 3600 }, // Keep last 100 completed jobs (up to 24 hours) for dashboard visibility
    removeOnFail: false, // Keep failed jobs so we can inspect them before moving to DLQ or if they natively fail
  },
};

// Main Queues
export const discoveryQueue = new Queue('discovery-queue', {
  connection: redisConfig,
  ...sharedQueueOptions,
});

export const intelligenceQueue = new Queue('intelligence-queue', {
  connection: redisConfig,
  ...sharedQueueOptions,
});

// V2: Identity Resolution
export const identityResolutionQueue = new Queue('identity-resolution-queue', {
  connection: redisConfig,
  ...sharedQueueOptions,
});

// V2: Website Intelligence (6-stage crawl pipeline)
export const websiteIntelligenceQueue = new Queue('website-intelligence-queue', {
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

export const contactDiscoveryQueue = new Queue('contact-discovery-queue', {
  connection: redisConfig,
  ...sharedQueueOptions,
});

export const leadScoringQueue = new Queue('lead-scoring-queue', {
  connection: redisConfig,
  ...sharedQueueOptions,
});

export const outreachQueue = new Queue('outreach-engine-queue', {
  connection: redisConfig,
  ...sharedQueueOptions,
});

// V3 Pipeline Extensions
export const cacheCheckQueue = new Queue('cache-check-queue', {
  connection: redisConfig,
  ...sharedQueueOptions,
});

export const confidenceEvaluationQueue = new Queue('confidence-evaluation-queue', {
  connection: redisConfig,
  ...sharedQueueOptions,
});

export const adaptiveEnrichmentQueue = new Queue('adaptive-enrichment-queue', {
  connection: redisConfig,
  ...sharedQueueOptions,
});

export const proposalGenerationQueue = new Queue('proposal-generation-queue', {
  connection: redisConfig,
  ...sharedQueueOptions,
});

export const analysisQueue = new Queue('analysis-queue', {
  connection: redisConfig,
  ...sharedQueueOptions,
});

// Dead Letter Queues (DLQs)
export const failedAnalysisQueue = new Queue('failed-analysis', {
  connection: redisConfig,
});

export const failedDiscoveryQueue = new Queue('failed-discovery', {
  connection: redisConfig,
});

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

export const failedContactDiscoveryQueue = new Queue('failed-contact-discovery', {
  connection: redisConfig,
});

export const failedLeadScoringQueue = new Queue('failed-lead-scoring', {
  connection: redisConfig,
});

export const failedOutreachQueue = new Queue('failed-outreach', {
  connection: redisConfig,
});
