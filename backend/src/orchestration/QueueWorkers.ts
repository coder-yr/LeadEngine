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
  discoveryQueue,
  failedDiscoveryQueue,
  failedIntelligenceQueue, 
  failedAuditQueue, 
  failedInsightsQueue,
  failedBuyingSignalsQueue,
  failedContactDiscoveryQueue,
  failedLeadScoringQueue,
  outreachQueue,
  adaptiveEnrichmentQueue
} from './Queues.js';

import { IntelligenceService } from '../workers/intelligence/IntelligenceService.js';
import { AuditService } from '../workers/audit/AuditService.js';
import { AuditRepository } from '../workers/audit/AuditRepository.js';
import { AiInsightsService } from '../workers/ai-insights/AiInsightsService.js';
import { AiInsightsRepository } from '../workers/ai-insights/AiInsightsRepository.js';
import { BuyingSignalsService } from '../workers/buying-signals/BuyingSignalsService.js';
import { outreachWorker } from '../workers/outreach/OutreachEngineWorker.js';
import { identityResolutionWorker } from '../workers/intelligence/IdentityResolutionWorker.js';
import { websiteIntelligenceWorker, websiteCompletedWorker } from '../workers/intelligence/WebsiteIntelligenceWorker.js';
import { ContactDiscoveryService } from '../services/ContactDiscoveryService.js';
import { LeadScoringService } from '../services/LeadScoringService.js';


import { analysisWorker } from './AnalysisWorker.js';

// We import outreachWorker here to ensure it initializes and starts processing.
// Export it if needed
export { outreachWorker, identityResolutionWorker, websiteIntelligenceWorker, websiteCompletedWorker, analysisWorker };

// Worker Options
const workerOptions = {
  connection: redisConfig,
  concurrency: parseInt(process.env.WORKER_CONCURRENCY || '4', 10),
  metrics: {
    maxDataPoints: 24 * 60, // Keep 24 hours of minute-by-minute metrics
  },
};


import path from 'path';
import { StageDispatcher } from './StageDispatcher.js';
import { DiscoveryStage } from '../services/IdentityResolutionService.js';

import { discoveryCompletedQueue } from './Queues.js';
import { DiscoveryService } from '../services/discovery.service.js';

// 0. Discovery Completed Worker (Consumes from Python Worker)
export const discoveryCompletedWorker = new Worker(
  'discovery.completed.queue',
  async (job: Job<{ pipelineId: string; companyId: string; traceId: string; jobId: string; payload: any }>) => {
    const { pipelineId, traceId, jobId, payload } = job.data;
    const { logger } = createTraceLogger(traceId);
    
    logger.info({ pipelineId, jobId }, 'Processing completed discovery job from Python');
    
    const discoveryService = new DiscoveryService();
    await discoveryService.processDiscoveryResults(jobId, payload);
    
    // Identity resolution is triggered via OrchestratorService inside processDiscoveryResults for new companies.
    return { status: 'processed' };
  },
  workerOptions
);

discoveryCompletedWorker.on('failed', async (job, err) => {
  if (job && job.attemptsMade === job.opts.attempts) {
    const { logger } = createTraceLogger(job.data.traceId);
    logger.error({ err, pipelineId: job.data.pipelineId }, 'Discovery completion job failed permanently. Moving to DLQ.');
    await failedDiscoveryQueue.add('failed-discovery', job.data);
  }
});

// 1. Intelligence Worker (V3 Pipeline entry point for an existing company)
export const intelligenceWorker = new Worker(
  'intelligence-queue',
  async (job: Job<{ companyId: string; leadIdentityId?: string; traceId: string; stage?: DiscoveryStage }>) => {
    const { companyId, traceId, stage, leadIdentityId } = job.data;
    const { logger } = createTraceLogger(traceId);
    
    logger.info({ companyId, stage }, 'Starting intelligence pipeline for company');
    
    // Validate company exists
    const { data: company } = await supabase.from('companies').select('id, website_url').eq('id', companyId).single();
    if (!company) {
      throw new Error(`Company ${companyId} not found`);
    }

    // Advance to next stage (or IDENTITY_RESOLVED if starting fresh)
    await StageDispatcher.advance(leadIdentityId || companyId, stage || 'DISCOVERED', {
      supabase,
      companyId,
      traceId,
    });

    return { companyId, started: true };
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

// 2. Cache Check Worker
export const cacheCheckWorker = new Worker(
  'cache-check-queue',
  async (job: Job<{ leadIdentityId: string; companyId?: string; traceId?: string; stage: DiscoveryStage }>) => {
    const { leadIdentityId, companyId, traceId, stage } = job.data;
    const { logger } = createTraceLogger(traceId || leadIdentityId);
    
    logger.info({ leadIdentityId }, 'Checking cache for recent discovery');
    
    // Check if company was enriched in the last 30 days
    if (companyId) {
      const { data: company } = await supabase
        .from('companies')
        .select('enriched_at')
        .eq('id', companyId)
        .maybeSingle();

      if (company?.enriched_at) {
        const enrichedDate = new Date(company.enriched_at);
        const daysSinceEnrichment = (Date.now() - enrichedDate.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysSinceEnrichment < 30) {
          logger.info({ companyId, daysSinceEnrichment }, 'Company enriched recently, returning cached result');
          await StageDispatcher.advance(leadIdentityId, 'COMPLETE', {
            supabase,
            companyId,
            traceId,
            metadata: { skipped: true, reason: 'cached' }
          });
          return { cached: true, daysSinceEnrichment };
        }
      }
    }
    
    // Proceed to next stage
    await StageDispatcher.advance(leadIdentityId, stage, {
      supabase,
      companyId,
      traceId,
    });
    
    return { cached: false };
  },
  workerOptions
);

// 3. Confidence Evaluation Worker
export const confidenceEvaluationWorker = new Worker(
  'confidence-evaluation-queue',
  async (job: Job<{ leadIdentityId: string; companyId?: string; traceId?: string; stage: DiscoveryStage }>) => {
    const { leadIdentityId, companyId, traceId, stage } = job.data;
    const { logger } = createTraceLogger(traceId || leadIdentityId);
    
    logger.info({ leadIdentityId }, 'Evaluating confidence of extracted data');
    
    // Fetch the lead identity to check what was extracted
    const { data: identity } = await supabase
      .from('lead_identities')
      .select('website_document, normalized_phone, normalized_domain, normalized_name')
      .eq('id', leadIdentityId)
      .maybeSingle();

    if (!identity) {
      throw new Error(`Lead Identity ${leadIdentityId} not found`);
    }

    const doc = identity.website_document || {};
    
    // Check signals
    const hasWebsite = !!identity.normalized_domain;
    const hasPhone = !!identity.normalized_phone || !!(doc.contacts && doc.contacts.phone_numbers && doc.contacts.phone_numbers.length > 0);
    const hasEmail = !!(doc.contacts && doc.contacts.emails && doc.contacts.emails.length > 0);
    const hasLeadership = !!(doc.leadership && Object.keys(doc.leadership).length > 0);
    const hasSocial = !!(doc.social && Object.keys(doc.social).length > 0);

    let confidence = 0;
    if (hasWebsite) confidence += 40;
    if (hasPhone) confidence += 20;
    if (hasEmail) confidence += 20;
    if (hasLeadership) confidence += 10;
    if (hasSocial) confidence += 10;

    const needsEnrichment = confidence < 80 || !hasPhone || !hasEmail;
    
    logger.info({ 
      leadIdentityId, 
      confidence, 
      needsEnrichment, 
      signals: { hasWebsite, hasPhone, hasEmail, hasLeadership, hasSocial } 
    }, 'Confidence evaluated');

    // Update DB with confidence
    await supabase.from('lead_identities').update({
      identity_confidence: confidence,
    }).eq('id', leadIdentityId);

    if (needsEnrichment) {
      await adaptiveEnrichmentQueue.add('enrich-lead', {
        leadIdentityId,
        companyId,
        traceId,
        stage: 'ADAPTIVE_ENRICHMENT',
        missing: {
          phone: !hasPhone,
          email: !hasEmail,
          leadership: !hasLeadership,
          social: !hasSocial,
          website: !hasWebsite,
        }
      });
      // Do not advance stage via dispatcher because we manually routed to enrichment
    } else {
      // Skip enrichment, go straight to next stage
      await StageDispatcher.advance(leadIdentityId, 'ADAPTIVE_ENRICHMENT', { // effectively skips it and moves to AI_INTELLIGENCE
        supabase,
        companyId,
        traceId,
        metadata: { skippedEnrichment: true, confidence }
      });
    }

    return { confidence, needsEnrichment };
  },
  workerOptions
);

confidenceEvaluationWorker.on('failed', async (job, err) => {
  if (job && job.attemptsMade === job.opts.attempts) {
    const { logger } = createTraceLogger(job.data.traceId || job.data.leadIdentityId);
    logger.error({ err, leadIdentityId: job.data.leadIdentityId }, 'Confidence evaluation failed permanently.');
  }
});

// 4. Adaptive Enrichment Worker
export const adaptiveEnrichmentWorker = new Worker(
  'adaptive-enrichment-queue',
  async (job: Job<{ leadIdentityId: string; companyId?: string; traceId?: string; stage: DiscoveryStage; missing: any }>) => {
    const { leadIdentityId, companyId, traceId, stage, missing } = job.data;
    const { logger } = createTraceLogger(traceId || leadIdentityId);
    
    logger.info({ leadIdentityId, missing }, 'Starting adaptive enrichment');
    
    // Determine which sources to run based on missing data
    const sourcesToRun: string[] = [];
    if (missing.phone) sourcesToRun.push('justdial', 'asklaila', 'grotal', 'yellowpages', 'hotfrog');
    if (missing.website) sourcesToRun.push('duckduckgo', 'google_dorks');
    // For now, we will run the discovery_runner again with specific sources
    
    if (sourcesToRun.length > 0) {
      const { data: company } = await supabase.from('companies').select('name, city, state_province').eq('id', companyId).maybeSingle();
      if (company) {
        const keyword = company.name;
        const city = company.city || company.state_province || '';
        
        try {
          const { discoveryExecuteQueue } = await import('./Queues.js');
          
          await discoveryExecuteQueue.add('run-discovery', {
             pipelineId: leadIdentityId,
             companyId: companyId,
             traceId: traceId,
             keyword: keyword,
             city: city,
             sources: sourcesToRun,
             max_results: 5,
             stage: 'ADAPTIVE_ENRICHMENT' // Pass the stage so the completion worker knows where it came from
          });
          
          logger.info({ leadIdentityId }, 'Adaptive enrichment queued via Python worker');
          return { enrichmentQueued: true };
          
        } catch (err: any) {
          logger.error({ err: err.message }, 'Adaptive enrichment failed to queue');
        }
      }
    }
    
    // If we didn't rewind, just advance to next stage
    await StageDispatcher.advance(leadIdentityId, stage, {
      supabase,
      companyId,
      traceId,
    });
    
    return { enrichmentRan: sourcesToRun.length > 0 };
  },
  workerOptions
);

adaptiveEnrichmentWorker.on('failed', async (job, err) => {
  if (job && job.attemptsMade === job.opts.attempts) {
    const { logger } = createTraceLogger(job.data.traceId || job.data.leadIdentityId);
    logger.error({ err, leadIdentityId: job.data.leadIdentityId }, 'Adaptive enrichment failed permanently.');
  }
});

import { contactCompletedQueue } from './Queues.js';

// 5a. Contact Discovery Trigger Worker (Consumes Orchestrator Queue, Enqueues to Python)
export const contactDiscoveryWorker = new Worker(
  'contact-discovery-queue',
  async (job: Job<{ leadIdentityId: string; companyId: string; traceId?: string; stage: DiscoveryStage }>) => {
    const { leadIdentityId, companyId, traceId, stage } = job.data;
    const { logger } = createTraceLogger(traceId || leadIdentityId);
    
    logger.info({ companyId, leadIdentityId }, 'Triggering contact discovery via Python worker');
    
    const { data: company } = await supabase.from('companies').select('name, website_url').eq('id', companyId).maybeSingle();

    if (company && company.website_url) {
      const contactDiscoveryService = new ContactDiscoveryService();
      await contactDiscoveryService.triggerContactDiscovery(
         companyId,
         company.name,
         company.website_url,
         leadIdentityId,
         traceId
      );
      return { status: 'queued' };
    } else {
        logger.warn({ companyId }, 'Skipping contact discovery (no website)');
        await StageDispatcher.advance(leadIdentityId, stage, {
          supabase,
          companyId,
          traceId,
          metadata: { skipped: true }
        });
        return { status: 'skipped' };
    }
  },
  workerOptions
);

contactDiscoveryWorker.on('failed', async (job, err) => {
  if (job && job.attemptsMade === job.opts.attempts) {
    const { logger } = createTraceLogger(job.data.traceId || job.data.leadIdentityId);
    logger.error({ err, companyId: job.data.companyId }, 'Contact discovery trigger failed permanently. Moving to DLQ.');
    await failedContactDiscoveryQueue.add('failed-contact-discovery', job.data);
  }
});

// 5b. Contact Discovery Completed Worker (Consumes from Python)
export const contactCompletedWorker = new Worker(
  'contact.completed.queue',
  async (job: Job<{ pipelineId: string; companyId: string; traceId: string; payload: any }>) => {
     const { payload, companyId, pipelineId, traceId } = job.data;
     const { logger } = createTraceLogger(traceId || pipelineId);
     
     logger.info({ pipelineId, companyId }, 'Processing completed contact discovery from Python');
     
     const contactDiscoveryService = new ContactDiscoveryService();
     const contactsFound = await contactDiscoveryService.processContactDiscoveryResults(companyId, payload);
     
     // Advance to next stage
     await StageDispatcher.advance(pipelineId, 'CONTACT_DISCOVERY' as any, {
       supabase,
       companyId,
       traceId,
       metadata: { contactsFound }
     });
     
     return { contactsFound };
  },
  workerOptions
);

contactCompletedWorker.on('failed', async (job, err) => {
  if (job && job.attemptsMade === job.opts.attempts) {
    const { logger } = createTraceLogger(job.data.traceId || job.data.pipelineId);
    logger.error({ err, companyId: job.data.companyId }, 'Contact discovery completed job failed permanently.');
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
    const aiInsightsService = new AiInsightsService(supabase, aiInsightsRepository, ollamaUrl);
    
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
    const id = job.data?.companyId || job.data?.keyword || 'unknown';
    console.log(`[STAGE: ${stageName}] Job Started - JobId: ${job.id}, Target: ${id}`);
  });
  worker.on('completed', (job) => {
    const id = job.data?.companyId || job.data?.keyword || 'unknown';
    console.log(`[STAGE: ${stageName}] Job Completed - JobId: ${job.id}, Target: ${id}`);
  });
  worker.on('failed', (job, err) => {
    const id = job?.data?.companyId || job?.data?.keyword || 'unknown';
    console.log(`[STAGE: ${stageName}] Job Failed - JobId: ${job?.id}, Target: ${id}. Error: ${err.message}`);
  });
}


attachLifecycleLogs(intelligenceWorker, 'Intelligence');
attachLifecycleLogs(cacheCheckWorker, 'Cache Check');
attachLifecycleLogs(confidenceEvaluationWorker, 'Confidence Evaluation');
attachLifecycleLogs(adaptiveEnrichmentWorker, 'Adaptive Enrichment');
attachLifecycleLogs(contactDiscoveryWorker, 'Contact Discovery');
attachLifecycleLogs(websiteAuditWorker, 'Website Audit');
attachLifecycleLogs(aiInsightsWorker, 'AI Insights');
attachLifecycleLogs(leadScoringWorker, 'Lead Scoring');
attachLifecycleLogs(buyingSignalsWorker, 'Buying Signals');
attachLifecycleLogs(analysisWorker, 'Company Analysis');

console.log('=== ALL BULLMQ WORKERS SUCCESSFULLY REGISTERED ===');


