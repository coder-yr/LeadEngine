import { Worker, Job } from 'bullmq';
import { spawn } from 'child_process';
import path from 'path';
import { redisConfig } from '../../config/redis.js';
import { supabase } from '../../config/supabase.js';
import { createTraceLogger } from '../../utils/logger.js';
import { StageDispatcher } from '../../orchestration/StageDispatcher.js';
import { DiscoveryStage, IdentityResolutionService } from '../../services/IdentityResolutionService.js';

const workerOptions = {
  connection: redisConfig,
  concurrency: 4,
};

export const identityResolutionWorker = new Worker(
  'identity-resolution-queue',
  async (job: Job<{ companyId?: string; traceId?: string; stage: DiscoveryStage; discoveryOutput: any }>) => {
    const { companyId, traceId, stage, discoveryOutput } = job.data;
    const { logger } = createTraceLogger(traceId || companyId || 'discovery');
    
    logger.info({ companyId, stage }, 'Starting identity resolution');

    const svc = new IdentityResolutionService(supabase);
    
    // Convert discovery output into lead identities
    // Assume discoveryOutput.results is the array of DiscoveryRecords
    let records = discoveryOutput?.results || [];
    let primaryIdentityId: string | null = null;
    let maxScore = -1;

    if (records.length === 0 && companyId) {
      const { data: company } = await supabase.from('companies').select('*').eq('id', companyId).single();
      if (company) {
        if (company.lead_identity_id) {
          primaryIdentityId = company.lead_identity_id;
        } else {
          primaryIdentityId = await svc.upsertIdentity({
            normalizedName: company.name,
            normalizedPhone: company.phone ? company.phone.replace(/\D/g, '').slice(-10) : null,
            normalizedDomain: company.website_url ? company.website_url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] : null,
            sourceNames: ['bulk_analysis'],
            identityConfidence: 50,
          });
        }
      }
    }

    for (const rec of records) {
      try {
        const id = await svc.upsertIdentity({
          normalizedName: rec.business_name,
          normalizedPhone: rec.phone ? rec.phone.replace(/\D/g, '').slice(-10) : null,
          normalizedDomain: rec.website ? rec.website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] : null,
          gstin: rec.gstin,
          cin: rec.cin,
          sourceNames: [rec.source],
          identityConfidence: rec.quality_score || 0,
        });

        // Track the best one to link to the company
        if ((rec.quality_score || 0) > maxScore) {
          maxScore = rec.quality_score || 0;
          primaryIdentityId = id;
        }
      } catch (err: any) {
        logger.error({ error: err.message, record: rec }, 'Failed to upsert identity');
      }
    }

    if (companyId && primaryIdentityId) {
      await svc.linkCompany(companyId, primaryIdentityId);
    }

    if (primaryIdentityId) {
      await StageDispatcher.advance(primaryIdentityId, stage, {
        supabase,
        companyId,
        traceId,
        metadata: { success: true },
      });
    }

    return { primaryIdentityId, resolvedCount: records.length };
  },
  workerOptions
);
