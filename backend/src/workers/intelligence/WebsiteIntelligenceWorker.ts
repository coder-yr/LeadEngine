import { Worker, Job } from 'bullmq';

import path from 'path';
import { redisConfig } from '../../config/redis.js';
import { supabase } from '../../config/supabase.js';
import { createTraceLogger } from '../../utils/logger.js';
import { StageDispatcher } from '../../orchestration/StageDispatcher.js';
import { DiscoveryStage } from '../../services/IdentityResolutionService.js';

const workerOptions = {
  connection: redisConfig,
  concurrency: 4,
};

import { websiteExecuteQueue, websiteCompletedQueue } from '../../orchestration/Queues.js';

export const websiteIntelligenceWorker = new Worker(
  'website-intelligence-queue',
  async (job: Job<{ leadIdentityId: string; companyId?: string; traceId?: string; stage: DiscoveryStage }>) => {
    const { leadIdentityId, companyId, traceId, stage } = job.data;
    const { logger } = createTraceLogger(traceId || leadIdentityId);
    
    logger.info({ leadIdentityId, stage }, 'Triggering website intelligence pipeline via Python worker');

    // 1. Get identity details
    const { data: identity } = await supabase
      .from('lead_identities')
      .select('normalized_domain')
      .eq('id', leadIdentityId)
      .maybeSingle();

    if (!identity || !identity.normalized_domain) {
      logger.warn({ leadIdentityId }, 'No domain found for lead identity, skipping website intelligence');
      await StageDispatcher.advance(leadIdentityId, stage, {
        supabase,
        companyId,
        traceId,
        metadata: { success: false, errorMessage: 'No domain found' },
      });
      return { skipped: true, reason: 'No domain found' };
    }

    const url = `https://${identity.normalized_domain}`;

    // 2. Enqueue to website.execute.queue
    const payload = {
      pipelineId: leadIdentityId,
      companyId: companyId,
      traceId: traceId,
      url: url,
      stage: stage
    };
    
    await websiteExecuteQueue.add('run-website-intelligence', payload);

    return { status: 'queued' };
  },
  workerOptions
);

export const websiteCompletedWorker = new Worker(
  'website.completed.queue',
  async (job: Job<{ pipelineId: string; companyId?: string; traceId?: string; payload: any }>) => {
    const { pipelineId, companyId, traceId, payload } = job.data;
    const { logger } = createTraceLogger(traceId || pipelineId);
    
    logger.info({ pipelineId, companyId }, 'Processing completed website intelligence from Python');

    const result = payload;

    if (result.status === 'error' || result.status === 'failed') {
      logger.warn({ pipelineId, error: result.error }, 'Website Intelligence failed');
      await StageDispatcher.advance(pipelineId, 'WEBSITE_INTELLIGENCE' as any, {
        supabase,
        companyId,
        traceId,
        metadata: { success: false, errorMessage: result.error },
      });
      return result;
    }

    // 3. Save Website Document to DB (Provenance)
    const doc = result.document || result.evidence?.[0] || result.results?.[0]; // Fallbacks for old/new schema
    await supabase
      .from('lead_identities')
      .update({
        website_document: doc,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pipelineId);

    // Also update legacy company fields if linked
    if (companyId && result.legacy) {
      const legacy = result.legacy;
      await supabase.from('companies').update({
        has_website: true,
        has_contact_form: legacy.has_contact_form,
        has_whatsapp_widget: legacy.has_whatsapp_widget,
        has_booking_system: legacy.has_booking_system,
        has_crm: legacy.has_crm_integration,
      }).eq('id', companyId);
    }

    // 4. Advance Stage
    await StageDispatcher.advance(pipelineId, 'WEBSITE_INTELLIGENCE' as any, {
      supabase,
      companyId,
      traceId,
      metadata: { success: true },
    });

    return result;
  },
  workerOptions
);

websiteCompletedWorker.on('failed', async (job, err) => {
  if (job && job.attemptsMade === job.opts.attempts) {
    const { logger } = createTraceLogger(job.data.traceId || job.data.pipelineId);
    logger.error({ err, leadIdentityId: job.data.pipelineId }, 'Website intelligence completed job failed permanently.');
  }
});
