import { Queue, Worker, Job } from 'bullmq';
import { redisConfig } from '../../config/redis.js';
import { IntelligenceService } from './IntelligenceService.js';

export const INTELLIGENCE_QUEUE_NAME = 'intelligence-queue';

export const intelligenceQueue = new Queue(INTELLIGENCE_QUEUE_NAME, {
  connection: redisConfig,
});

const intelligenceService = new IntelligenceService();

export const intelligenceWorker = new Worker(
  INTELLIGENCE_QUEUE_NAME,
  async (job: Job) => {
    console.log(`[Intelligence Worker] Processing job ${job.id} for company ${job.data.companyId}`);
    try {
      const companyId = job.data.companyId;
      if (!companyId) {
        throw new Error('companyId is missing in job data');
      }

      const result = await intelligenceService.analyzeCompany(companyId);
      console.log(`[Intelligence Worker] Completed analysis for company ${companyId}`);
      return result;
    } catch (error) {
      console.error(`[Intelligence Worker] Job ${job.id} failed:`, error);
      throw error;
    }
  },
  {
    connection: redisConfig,
  }
);

intelligenceWorker.on('completed', (job) => {
  console.log(`[Intelligence Worker] Job ${job.id} has completed!`);
});

intelligenceWorker.on('failed', (job, err) => {
  console.error(`[Intelligence Worker] Job ${job?.id} has failed with ${err.message}`);
});
