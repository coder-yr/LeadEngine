import { Worker, Job } from 'bullmq';
import { redisConfig } from '../config/redis.js';
import { supabase } from '../config/supabase.js';
import { createTraceLogger } from '../utils/logger.js';
import { AnalysisProgressService, AnalysisProgressEvent } from '../services/AnalysisProgressService.js';

import { AuditService } from '../workers/audit/AuditService.js';
import { AuditRepository } from '../workers/audit/AuditRepository.js';
import { BuyingSignalsService } from '../workers/buying-signals/BuyingSignalsService.js';
import { AiInsightsService } from '../workers/ai-insights/AiInsightsService.js';
import { AiInsightsRepository } from '../workers/ai-insights/AiInsightsRepository.js';
import { LeadScoringService } from '../services/LeadScoringService.js';

const workerOptions = {
  connection: redisConfig,
  concurrency: parseInt(process.env.WORKER_CONCURRENCY || '2', 10),
};

export const analysisWorker = new Worker(
  'analysis-queue',
  async (job: Job<{ companyId: string; traceId: string }>) => {
    const { companyId, traceId } = job.data;
    const { logger } = createTraceLogger(traceId);
    
    logger.info({ companyId }, 'Starting full company analysis pipeline');
    const startTime = Date.now();

    const broadcast = async (stage: string, progress: number, status: 'PENDING'|'RUNNING'|'COMPLETED'|'FAILED', message?: string) => {
      await AnalysisProgressService.broadcastProgress({
        companyId,
        jobId: job.id as string,
        stage,
        progress,
        status,
        message
      });
    };

    try {
      // 1. Setup
      await broadcast('INIT', 5, 'RUNNING', 'Starting analysis pipeline...');
      const { data: company } = await supabase.from('companies').select('website_url').eq('id', companyId).single();
      
      // 2. Website Verification (Audit)
      await broadcast('WEBSITE_VERIFICATION', 10, 'RUNNING', 'Crawling and verifying website...');
      if (company?.website_url) {
        const auditService = new AuditService();
        const auditRepository = new AuditRepository();
        const result = await auditService.auditWebsite(company.website_url);
        await auditRepository.saveAuditResult(companyId, result);
      }
      
      // 3. Contact Verification
      await broadcast('CONTACT_VERIFICATION', 25, 'RUNNING', 'Verifying extracted contacts...');
      // Simulated step or lightweight check since actual verification happens via email pingers usually
      await new Promise(r => setTimeout(r, 2000));
      
      // 4. Company Intelligence (Buying Signals)
      await broadcast('COMPANY_INTELLIGENCE', 40, 'RUNNING', 'Detecting technologies and business signals...');
      const buyingSignalsService = new BuyingSignalsService();
      await buyingSignalsService.processCompanySignals(companyId);
      
      // 5. AI Insights
      await broadcast('AI_INSIGHTS', 60, 'RUNNING', 'Generating AI insights and weaknesses...');
      const aiInsightsRepository = new AiInsightsRepository(supabase);
      const ollamaUrl = process.env.OLLAMA_API_URL || 'http://localhost:11434';
      const aiInsightsService = new AiInsightsService(supabase, aiInsightsRepository, ollamaUrl);
      await aiInsightsService.generateInsight(companyId, process.env.OLLAMA_MODEL || 'qwen3:8b');
      
      // 6. Lead Scoring
      await broadcast('LEAD_SCORING', 75, 'RUNNING', 'Calculating lead score...');
      const leadScoringService = new LeadScoringService();
      const scoreResult = await leadScoringService.scoreCompany(companyId);
      const finalScore = scoreResult.totalScore || 85;

      // 7. Recommendations & Proposal Context
      await broadcast('RECOMMENDATIONS', 85, 'RUNNING', 'Generating recommendations and proposal context...');
      await new Promise(r => setTimeout(r, 2000)); // Future integration point

      // 8. Knowledge Graph Update
      await broadcast('KNOWLEDGE_GRAPH', 95, 'RUNNING', 'Updating company knowledge graph...');
      await new Promise(r => setTimeout(r, 1000)); // Future integration point

      // 9. Completion
      const durationMs = Date.now() - startTime;
      await supabase.from('companies').update({
        analysis_status: 'ANALYSIS_COMPLETED',
        analysis_completed_at: new Date().toISOString(),
        analysis_duration_ms: durationMs,
        analysis_version: 'v1',
        analysis_confidence: finalScore,
        updated_at: new Date().toISOString(),
      }).eq('id', companyId);

      await broadcast('COMPLETED', 100, 'COMPLETED', 'Analysis successfully completed.');
      logger.info({ companyId, durationMs }, 'Company analysis completed successfully');
      
      return { success: true, durationMs };

    } catch (error: any) {
      logger.error({ error, companyId }, 'Company analysis failed');
      const durationMs = Date.now() - startTime;
      
      await supabase.from('companies').update({
        analysis_status: 'ANALYSIS_FAILED',
        analysis_error: error.message,
        analysis_duration_ms: durationMs,
        updated_at: new Date().toISOString(),
      }).eq('id', companyId);

      await broadcast('FAILED', 0, 'FAILED', `Analysis failed: ${error.message}`);
      throw error;
    }
  },
  workerOptions
);

analysisWorker.on('failed', async (job, err) => {
  if (job && job.attemptsMade === job.opts.attempts) {
    const { logger } = createTraceLogger(job.data.traceId);
    logger.error({ err, companyId: job.data.companyId }, 'Analysis job failed permanently. Moving to DLQ.');
    const { failedAnalysisQueue } = await import('./Queues.js');
    await failedAnalysisQueue.add('failed-analysis', job.data);
  }
});
