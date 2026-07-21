import { supabase } from '../config/supabase.js';
import { analysisQueue } from '../orchestration/Queues.js';
import { createTraceLogger } from '../utils/logger.js';
import { randomUUID } from 'crypto';

export class AnalysisService {
  /**
   * Starts the analysis pipeline for a single company
   */
  async startAnalysis(companyId: string, traceId?: string): Promise<{ jobId: string }> {
    const activeTraceId = traceId || randomUUID();
    const { logger } = createTraceLogger(activeTraceId);

    logger.info({ companyId }, 'Starting analysis pipeline');

    // 1. Mark company as ANALYSIS_RUNNING in DB
    const { error } = await supabase
      .from('companies')
      .update({
        analysis_status: 'ANALYSIS_RUNNING',
        analysis_started_at: new Date().toISOString(),
        analysis_progress: { stage: 'INIT', status: 'PENDING', progress: 0 },
        needs_reanalysis: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', companyId);

    if (error) {
      logger.error({ error, companyId }, 'Failed to update company analysis status');
      throw new Error(`Failed to update company analysis status: ${error.message}`);
    }

    // 2. Enqueue the analysis job
    const job = await analysisQueue.add('analyze-company', {
      companyId,
      traceId: activeTraceId,
    });

    return { jobId: job.id as string };
  }

  /**
   * Starts the analysis pipeline for multiple companies
   */
  async startBulkAnalysis(companyIds: string[]): Promise<{ jobIds: string[] }> {
    const traceId = randomUUID();
    const jobIds: string[] = [];

    for (const companyId of companyIds) {
      try {
        const { jobId } = await this.startAnalysis(companyId, traceId);
        jobIds.push(jobId);
      } catch (e) {
        console.error(`Failed to start analysis for company ${companyId}:`, e);
      }
    }

    return { jobIds };
  }

  /**
   * Gets the current analysis state for a company
   */
  async getAnalysisState(companyId: string): Promise<any> {
    const { data, error } = await supabase
      .from('companies')
      .select('analysis_status, analysis_progress, analysis_started_at, analysis_completed_at, analysis_confidence, needs_reanalysis')
      .eq('id', companyId)
      .single();

    if (error || !data) {
      throw new Error(`Failed to get analysis state for company ${companyId}`);
    }

    return data;
  }
}
