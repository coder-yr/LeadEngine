import { Queue } from 'bullmq';
import { redisConfig } from '../config/redis.js';
import { createTraceLogger } from '../utils/logger.js';
import { IdentityResolutionService, DiscoveryStage } from '../services/IdentityResolutionService.js';
import {
  intelligenceQueue,
  identityResolutionQueue,
  websiteIntelligenceQueue,
  websiteAuditQueue,
  aiInsightsQueue,
  contactDiscoveryQueue,
  leadScoringQueue,
  cacheCheckQueue,
  confidenceEvaluationQueue,
  adaptiveEnrichmentQueue,
  proposalGenerationQueue,
} from './Queues.js';

// Map of stage → next action
const STAGE_TO_QUEUE: Partial<Record<DiscoveryStage, { queue: Queue; jobName: string }>> = {
  DISCOVERED:           { queue: identityResolutionQueue,   jobName: 'resolve-identity' },
  IDENTITY_RESOLVED:    { queue: cacheCheckQueue,           jobName: 'check-cache' },
  WEBSITE_SELECTED:     { queue: websiteIntelligenceQueue,  jobName: 'crawl-website' },
  WEBSITE_CRAWLED:      { queue: confidenceEvaluationQueue, jobName: 'evaluate-confidence' },
  CONFIDENCE_EVALUATED: { queue: adaptiveEnrichmentQueue,   jobName: 'enrich-lead' }, 
  ADAPTIVE_ENRICHMENT:  { queue: contactDiscoveryQueue,     jobName: 'discover-contacts' },
  // Pipeline now stops after CONTACTS_EXTRACTED.
  // The terminal state becomes READY_FOR_ANALYSIS instead of chaining to AI_INTELLIGENCE.
};

/**
 * StageDispatcher — Event-driven pipeline advancement.
 *
 * Instead of hardcoding queue chains in each worker,
 * every worker calls StageDispatcher.advance() when it completes.
 * The dispatcher reads the current stage from lead_identities and
 * enqueues the appropriate next job.
 *
 * This enables:
 *   - Resume from any stage (lead_identities.stage is the checkpoint)
 *   - Adding new pipeline stages without touching existing workers
 *   - Full audit trail in discovery_stages_log
 */
export class StageDispatcher {
  private static getIdentityService(supabase: any): IdentityResolutionService {
    return new IdentityResolutionService(supabase);
  }

  /**
   * Advance a lead identity to the next stage.
   * Called by workers on successful completion.
   */
  static async advance(
    leadIdentityId: string,
    completedStage: DiscoveryStage,
    options: {
      supabase: any;
      companyId?: string;
      traceId?: string;
      durationMs?: number;
      metadata?: Record<string, unknown>;
    }
  ): Promise<DiscoveryStage | null> {
    const { supabase, companyId, traceId, durationMs, metadata } = options;
    const { logger } = createTraceLogger(traceId || leadIdentityId);

    // Compute next stage
    const nextStageKey = STAGE_TO_QUEUE[completedStage];
    if (!nextStageKey) {
      logger.info({ leadIdentityId, completedStage }, 'Lead reached terminal stage READY_FOR_ANALYSIS');
      const svc = this.getIdentityService(supabase);
      await svc.advanceStage(leadIdentityId, 'READY_FOR_ANALYSIS', {
        fromStage: completedStage,
        companyId,
        durationMs,
        success: true,
        metadata,
      });
      return 'READY_FOR_ANALYSIS';
    }

    // Determine next stage from queue mapping
    const QUEUE_TO_STAGE: Record<string, DiscoveryStage> = {
      'resolve-identity':      'IDENTITY_RESOLVED',
      'check-cache':           'WEBSITE_SELECTED',
      'crawl-website':         'WEBSITE_CRAWLED',
      'evaluate-confidence':   'CONFIDENCE_EVALUATED',
      'enrich-lead':           'ADAPTIVE_ENRICHMENT',
      'discover-contacts':     'CONTACTS_EXTRACTED',
      'generate-ai-insights':  'AI_INTELLIGENCE',
      'score-lead':            'LEAD_SCORED',
      'generate-proposal':     'COMPLETE',
    };
    const nextStage = QUEUE_TO_STAGE[nextStageKey.jobName] as DiscoveryStage;

    try {
      const svc = this.getIdentityService(supabase);

      // Advance stage in DB
      await svc.advanceStage(leadIdentityId, nextStage, {
        fromStage: completedStage,
        companyId,
        durationMs,
        success: true,
        metadata,
      });

      // Enqueue next job
      await nextStageKey.queue.add(nextStageKey.jobName, {
        leadIdentityId,
        companyId,
        traceId,
        stage: nextStage,
      });

      logger.info(
        { leadIdentityId, completedStage, nextStage },
        'Stage advanced'
      );

      return nextStage;
    } catch (err: any) {
      logger.error(
        { leadIdentityId, completedStage, err: err.message },
        'StageDispatcher failed to advance'
      );
      throw err;
    }
  }

  /**
   * Resume a lead identity from its last known stage.
   * Called by the resume endpoint or admin.
   */
  static async resume(
    leadIdentityId: string,
    options: {
      supabase: any;
      companyId?: string;
      traceId?: string;
    }
  ): Promise<DiscoveryStage | null> {
    const { supabase } = options;
    const svc = this.getIdentityService(supabase);
    const currentStage = await svc.getCurrentStage(leadIdentityId);

    if (!currentStage) {
      throw new Error(`Lead identity ${leadIdentityId} not found`);
    }

    // Re-dispatch from the PREVIOUS stage to re-run the current one
    const PREV_STAGE: Partial<Record<DiscoveryStage, DiscoveryStage>> = {
      IDENTITY_RESOLVED:    'DISCOVERED',
      WEBSITE_SELECTED:     'IDENTITY_RESOLVED',
      WEBSITE_CRAWLED:      'WEBSITE_SELECTED',
      CONFIDENCE_EVALUATED: 'WEBSITE_CRAWLED',
      ADAPTIVE_ENRICHMENT:  'CONFIDENCE_EVALUATED',
      AI_INTELLIGENCE:      'ADAPTIVE_ENRICHMENT',
      LEAD_SCORED:          'AI_INTELLIGENCE',
      COMPLETE:             'LEAD_SCORED',
      READY:                'COMPLETE',
    };

    const resumeFrom = PREV_STAGE[currentStage] || 'DISCOVERED';
    return this.advance(leadIdentityId, resumeFrom, options);
  }

  /**
   * Start a new pipeline for a company (entry point).
   * Creates or finds identity, then dispatches first stage.
   */
  static async start(
    companyId: string,
    leadIdentityId: string | null,
    options: {
      supabase: any;
      traceId?: string;
    }
  ): Promise<void> {
    await intelligenceQueue.add('analyze-company', {
      companyId,
      leadIdentityId,
      traceId: options.traceId,
      stage: 'DISCOVERED',
    });
  }
}
