import crypto from 'node:crypto';
import { createTraceLogger } from '../utils/logger.js';
import { intelligenceQueue } from './Queues.js';

export class OrchestratorService {
  /**
   * Starts the company intelligence and audit workflow.
   * This should be called whenever a company is successfully created or imported.
   */
  static async startCompanyWorkflow(companyId: string, traceId?: string): Promise<string> {
    const finalTraceId = traceId || crypto.randomUUID();
    const { logger } = createTraceLogger(finalTraceId);

    logger.info({ companyId }, 'Starting new orchestration workflow for company');

    await intelligenceQueue.add('analyze-company', {
      companyId,
      traceId: finalTraceId,
    });

    logger.info({ companyId }, 'Successfully queued initial intelligence job');
    
    return finalTraceId;
  }
}
