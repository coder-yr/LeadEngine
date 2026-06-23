import { Worker, Job } from 'bullmq';
import { redisConfig } from '../config/redis.js';
import { supabase } from '../config/supabase.js';

import { createTraceLogger } from '../utils/logger.js';
import { 
  websiteAuditQueue, 
  aiInsightsQueue, 
  buyingSignalsQueue,
  contactDiscoveryQueue,
  leadScoringQueue,
  failedIntelligenceQueue, 
  failedAuditQueue, 
  failedInsightsQueue,
  failedBuyingSignalsQueue,
  failedContactDiscoveryQueue,
  failedLeadScoringQueue,
  outreachQueue
} from './Queues.js';

import { IntelligenceService } from '../workers/intelligence/IntelligenceService.js';
import { AuditService } from '../workers/audit/AuditService.js';
import { AuditRepository } from '../workers/audit/AuditRepository.js';
import { AiInsightsService } from '../workers/ai-insights/AiInsightsService.js';
import { AiInsightsRepository } from '../workers/ai-insights/AiInsightsRepository.js';
import { BuyingSignalsService } from '../workers/buying-signals/BuyingSignalsService.js';
import { outreachWorker } from '../workers/outreach/OutreachEngineWorker.js';
import { ContactDiscoveryService } from '../services/ContactDiscoveryService.js';
import { LeadScoringService } from '../services/LeadScoringService.js';
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
    
    // Chain to Contact Discovery
    logger.info({ companyId }, 'Intelligence analysis completed, queuing contact discovery');
    await contactDiscoveryQueue.add('discover-contacts', { companyId, traceId });
    
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

// 2. Contact Discovery Worker
export const contactDiscoveryWorker = new Worker(
  'contact-discovery-queue',
  async (job: Job<{ companyId: string; traceId: string }>) => {
    const { companyId, traceId } = job.data;
    const { logger } = createTraceLogger(traceId);
    
    logger.info({ companyId }, 'Starting contact discovery');
    
    const contactDiscoveryService = new ContactDiscoveryService();
    const contactsCreated = await contactDiscoveryService.discoverContacts(companyId);
    
    // Chain to Website Audit
    logger.info({ companyId, contactsCreated }, 'Contact discovery completed, queuing website audit');
    await websiteAuditQueue.add('audit-website', { companyId, traceId });
    
    return { contactsCreated };
  },
  { ...workerOptions, concurrency: 1 } // Hard limit to 1 to prevent Playwright/Ollama overload
);

contactDiscoveryWorker.on('failed', async (job, err) => {
  if (job && job.attemptsMade === job.opts.attempts) {
    const { logger } = createTraceLogger(job.data.traceId);
    logger.error({ err, companyId: job.data.companyId }, 'Contact Discovery job failed permanently. Moving to DLQ.');
    await failedContactDiscoveryQueue.add('failed-contact-discovery', job.data);
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
    
    // Create/Update audit job to RUNNING
    let auditJobId: string | undefined;
    const existingJob = await supabase.from('audit_jobs').select('id').eq('company_id', companyId).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (existingJob.data) {
      auditJobId = existingJob.data.id;
      await supabase.from('audit_jobs').update({ status: 'RUNNING', url: url || 'fetching...' }).eq('id', auditJobId);
    } else {
      const newJob = await supabase.from('audit_jobs').insert({ company_id: companyId, url: url || 'fetching...', status: 'RUNNING' }).select().maybeSingle();
      if (newJob.data) auditJobId = newJob.data.id;
    }

    if (!url) {
      const website = await auditRepository.getCompanyWebsite(companyId);
      if (!website) {
        logger.warn({ companyId }, 'Company has no website. Skipping audit.');
        if (auditJobId) await supabase.from('audit_jobs').update({ status: 'FAILED' }).eq('id', auditJobId);
        // Skip audit, but chain to next step (Buying Signals)
        await buyingSignalsQueue.add('generate-signals', { companyId, traceId });
        return { skipped: true, reason: 'No website URL available' };
      }
      url = website;
      if (auditJobId) await supabase.from('audit_jobs').update({ url }).eq('id', auditJobId);
    }
    
    const auditService = new AuditService();
    const auditStartTime = Date.now();
    const result = await auditService.auditWebsite(url);
    await auditRepository.saveAuditResult(companyId, result);
    const auditEndTime = Date.now();
    
    if (auditJobId) await supabase.from('audit_jobs').update({ status: 'COMPLETED' }).eq('id', auditJobId);

    // Save extracted company info back to the companies table if present
    if (result.extractedCompanyInfo) {
      const updateData: any = {};
      if (result.extractedCompanyInfo.city) updateData.city = result.extractedCompanyInfo.city;
      if (result.extractedCompanyInfo.state_province) updateData.state_province = result.extractedCompanyInfo.state_province;
      if (result.extractedCompanyInfo.country) updateData.country = result.extractedCompanyInfo.country;
      if (result.extractedCompanyInfo.employee_count) updateData.employee_count = result.extractedCompanyInfo.employee_count;
      if (result.extractedCompanyInfo.industry) updateData.industry = result.extractedCompanyInfo.industry;
      if (result.extractedCompanyInfo.description) updateData.description = result.extractedCompanyInfo.description;
      
      if (Object.keys(updateData).length > 0) {
        await supabase.from('companies').update(updateData).eq('id', companyId);
        logger.info({ companyId, updateData }, 'Updated company details from LLM extraction');
      }
    }

    console.log('\n--- WEBSITE AUDIT REPORT ---');
    console.log(`Company ID: ${companyId}`);
    console.log(`Website: ${url}`);
    console.log(`Audit Started: ${new Date(auditStartTime).toISOString()}`);
    console.log(`Audit Completed: ${new Date(auditEndTime).toISOString()}`);
    console.log(`Audit Saved: Yes`);
    console.log('---------------------------------\n');
    
    // Explicit Chaining
    logger.info({ companyId }, 'Website audit completed, queuing buying signals engine');
    await buyingSignalsQueue.add('generate-signals', { companyId, traceId });
    
    return result;
  },
  workerOptions
);

websiteAuditWorker.on('failed', async (job, err) => {
  if (job) {
    if (job.data?.companyId) {
       await supabase.from('audit_jobs')
         .update({ status: 'FAILED' })
         .eq('company_id', job.data.companyId)
         .eq('status', 'RUNNING');
    }
    
    if (job.attemptsMade === job.opts.attempts) {
      const { logger } = createTraceLogger(job.data.traceId);
      logger.error({ err, companyId: job.data.companyId }, 'Audit job failed permanently. Moving to DLQ.');
      await failedAuditQueue.add('failed-audit', job.data);
    }
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
    
    // Chain to Lead Scoring (final step)
    logger.info({ companyId }, 'AI insights generation completed, queuing lead scoring');
    await leadScoringQueue.add('score-lead', { companyId, traceId });
    
    return result;
  },
  { ...workerOptions, concurrency: 1 } // Hard limit to 1 to prevent Ollama timeouts
);

aiInsightsWorker.on('failed', async (job, err) => {
  if (job && job.attemptsMade === job.opts.attempts) {
    const { logger } = createTraceLogger(job.data.traceId);
    logger.error({ err, companyId: job.data.companyId }, 'AI Insights job failed permanently. Moving to DLQ.');
    await failedInsightsQueue.add('failed-insights', job.data);
  }
});

// 6. Lead Scoring Worker (Final step in pipeline)
export const leadScoringWorker = new Worker(
  'lead-scoring-queue',
  async (job: Job<{ companyId: string; traceId: string }>) => {
    const { companyId, traceId } = job.data;
    const { logger } = createTraceLogger(traceId);
    
    logger.info({ companyId }, 'Starting lead scoring');
    
    const leadScoringService = new LeadScoringService();
    const scores = await leadScoringService.scoreCompany(companyId);
    
    logger.info(
      { companyId, ...scores },
      'Lead scoring completed. Full orchestration pipeline finished.'
    );
    return scores;
  },
  workerOptions
);

leadScoringWorker.on('failed', async (job, err) => {
  if (job && job.attemptsMade === job.opts.attempts) {
    const { logger } = createTraceLogger(job.data.traceId);
    logger.error({ err, companyId: job.data.companyId }, 'Lead Scoring job failed permanently. Moving to DLQ.');
    await failedLeadScoringQueue.add('failed-lead-scoring', job.data);
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

// Helper to attach lifecycle logs to all workers
function attachLifecycleLogs(worker: Worker, stageName: string) {
  worker.on('active', (job) => {
    console.log(`[STAGE: ${stageName}] Job Started - JobId: ${job.id}, Company: ${job.data.companyId}`);
  });
  worker.on('completed', (job) => {
    console.log(`[STAGE: ${stageName}] Job Completed - JobId: ${job.id}, Company: ${job.data.companyId}`);
  });
  worker.on('failed', (job, err) => {
    console.log(`[STAGE: ${stageName}] Job Failed - JobId: ${job?.id}, Company: ${job?.data?.companyId}. Error: ${err.message}`);
  });
}

attachLifecycleLogs(intelligenceWorker, 'Intelligence');
attachLifecycleLogs(contactDiscoveryWorker, 'Contact Discovery');
attachLifecycleLogs(websiteAuditWorker, 'Website Audit');
attachLifecycleLogs(aiInsightsWorker, 'AI Insights');
attachLifecycleLogs(leadScoringWorker, 'Lead Scoring');
attachLifecycleLogs(buyingSignalsWorker, 'Buying Signals');

console.log('=== ALL BULLMQ WORKERS SUCCESSFULLY REGISTERED ===');


