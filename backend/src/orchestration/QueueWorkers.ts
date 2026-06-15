import { Worker, Job } from 'bullmq';
import { redisConfig } from '../config/redis.js';
import { supabase } from '../config/supabase.js';

import { createTraceLogger } from '../utils/logger.js';
import { 
  websiteAuditQueue, 
  aiInsightsQueue, 
  buyingSignalsQueue,
  failedIntelligenceQueue, 
  failedAuditQueue, 
  failedInsightsQueue,
  failedBuyingSignalsQueue,
  outreachQueue
} from './Queues.js';

import { IntelligenceService } from '../workers/intelligence/IntelligenceService.js';
import { AuditService } from '../workers/audit/AuditService.js';
import { AuditRepository } from '../workers/audit/AuditRepository.js';
import { AiInsightsService } from '../workers/ai-insights/AiInsightsService.js';
import { AiInsightsRepository } from '../workers/ai-insights/AiInsightsRepository.js';
import { BuyingSignalsService } from '../workers/buying-signals/BuyingSignalsService.js';
import { outreachWorker } from '../workers/outreach/OutreachEngineWorker.js';
import { Ollama } from 'ollama';

// We import outreachWorker here to ensure it initializes and starts processing.
// Export it if needed
export { outreachWorker };

// Worker Options
const workerOptions = {
  connection: redisConfig,
  concurrency: parseInt(process.env.WORKER_CONCURRENCY || '4', 10),
  metrics: {
    maxDataPoints: 24 * 60, // Keep 24 hours of minute-by-minute metrics
  },
};

// 1. Intelligence Worker
export const intelligenceWorker = new Worker(
  'intelligence-queue',
  async (job: Job<{ companyId: string; traceId: string }>) => {
    const { companyId, traceId } = job.data;
    const { logger } = createTraceLogger(traceId);
    
    logger.info({ companyId }, 'Starting intelligence analysis');
    
    const intelligenceService = new IntelligenceService();
    const result = await intelligenceService.analyzeCompany(companyId);
    
    // Explicit Chaining
    logger.info({ companyId }, 'Intelligence analysis completed, queuing audit');
    await websiteAuditQueue.add('audit-website', { companyId, traceId });
    
    return result;
  },
  workerOptions
);

intelligenceWorker.on('failed', async (job, err) => {
  if (job && job.attemptsMade === job.opts.attempts) {
    const { logger } = createTraceLogger(job.data.traceId);
    logger.error({ err, companyId: job.data.companyId }, 'Intelligence job failed permanently. Moving to DLQ.');
    await failedIntelligenceQueue.add('failed-intelligence', job.data);
  }
});

// 2. Website Audit Worker
export const websiteAuditWorker = new Worker(
  'website-audit-queue',
  async (job: Job<{ companyId: string; traceId: string; url?: string }>) => {
    const { companyId, traceId } = job.data;
    const { logger } = createTraceLogger(traceId);
    
    logger.info({ companyId }, 'Starting website audit');
    
    const auditRepository = new AuditRepository();
    let url = job.data.url;
    
    if (!url) {
      const website = await auditRepository.getCompanyWebsite(companyId);
      if (!website) {
        logger.warn({ companyId }, 'Company has no website. Skipping audit.');
        // Skip audit, but chain to next step (Buying Signals)
        await buyingSignalsQueue.add('generate-signals', { companyId, traceId });
        return { skipped: true, reason: 'No website URL available' };
      }
      url = website;
    }
    
    const auditService = new AuditService();
    const result = await auditService.auditWebsite(url);
    await auditRepository.saveAuditResult(companyId, result);
    
    // Explicit Chaining
    logger.info({ companyId }, 'Website audit completed, queuing buying signals engine');
    await buyingSignalsQueue.add('generate-signals', { companyId, traceId });
    
    return result;
  },
  workerOptions
);

websiteAuditWorker.on('failed', async (job, err) => {
  if (job && job.attemptsMade === job.opts.attempts) {
    const { logger } = createTraceLogger(job.data.traceId);
    logger.error({ err, companyId: job.data.companyId }, 'Audit job failed permanently. Moving to DLQ.');
    await failedAuditQueue.add('failed-audit', job.data);
  }
});

// 3. AI Insights Worker
export const aiInsightsWorker = new Worker(
  'ai-insights-queue',
  async (job: Job<{ companyId: string; traceId: string; model?: string }>) => {
    const { companyId, traceId } = job.data;
    const { logger } = createTraceLogger(traceId);
    
    logger.info({ companyId }, 'Starting AI insights generation');
    
    const aiInsightsRepository = new AiInsightsRepository(supabase);
    const ollamaUrl = process.env.OLLAMA_API_URL || 'http://localhost:11434';
    const ollamaClient = new Ollama({ host: ollamaUrl });
    const aiInsightsService = new AiInsightsService(supabase, aiInsightsRepository, ollamaClient);
    
    const model = job.data.model || process.env.OLLAMA_MODEL || 'qwen3:8b';
    const result = await aiInsightsService.generateInsight(companyId, model);
    
    logger.info({ companyId }, 'AI insights generation completed. Orchestration workflow finished.');
    return result;
  },
  workerOptions
);

aiInsightsWorker.on('failed', async (job, err) => {
  if (job && job.attemptsMade === job.opts.attempts) {
    const { logger } = createTraceLogger(job.data.traceId);
    logger.error({ err, companyId: job.data.companyId }, 'AI Insights job failed permanently. Moving to DLQ.');
    await failedInsightsQueue.add('failed-insights', job.data);
  }
});

// 4. Buying Signals Worker
export const buyingSignalsWorker = new Worker(
  'buying-signals-queue',
  async (job: Job<{ companyId: string; traceId: string }>) => {
    const { companyId, traceId } = job.data;
    const { logger } = createTraceLogger(traceId);
    
    logger.info({ companyId }, 'Starting buying signals generation');
    
    const buyingSignalsService = new BuyingSignalsService();
    const result = await buyingSignalsService.processCompanySignals(companyId);
    
    // Explicit Chaining
    logger.info({ companyId }, 'Buying signals generated, queuing AI insights');
    await aiInsightsQueue.add('generate-insight', { companyId, traceId });
    
    return result;
  },
  workerOptions
);

buyingSignalsWorker.on('failed', async (job, err) => {
  if (job && job.attemptsMade === job.opts.attempts) {
    const { logger } = createTraceLogger(job.data.traceId);
    logger.error({ err, companyId: job.data.companyId }, 'Buying Signals job failed permanently. Moving to DLQ.');
    await failedBuyingSignalsQueue.add('failed-buying-signals', job.data);
  }
});
