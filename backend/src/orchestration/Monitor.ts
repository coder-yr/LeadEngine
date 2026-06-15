import { Queue } from 'bullmq';
import { 
  intelligenceQueue, 
  websiteAuditQueue, 
  aiInsightsQueue 
} from './Queues.js';
import { logger } from '../utils/logger.js';

export async function getQueueMonitoringData() {
  try {
    const [intelligence, audit, insights] = await Promise.all([
      getQueueStats('intelligence-queue', intelligenceQueue),
      getQueueStats('website-audit-queue', websiteAuditQueue),
      getQueueStats('ai-insights-queue', aiInsightsQueue),
    ]);

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      queues: {
        intelligence,
        audit,
        insights,
      },
    };
  } catch (error: any) {
    logger.error({ error }, '[Monitor] Failed to retrieve queue monitoring data');
    return {
      status: 'error',
      message: error.message,
    };
  }
}

async function getQueueStats(name: string, queue: Queue) {
  const [active, waiting, completed, failed, delayed] = await Promise.all([
    queue.getActiveCount(),
    queue.getWaitingCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  const total = active + waiting + completed + failed + delayed;
  
  let successRate = 100;
  if (completed + failed > 0) {
    successRate = (completed / (completed + failed)) * 100;
  }

  return {
    name,
    active,
    waiting,
    completed,
    failed,
    delayed,
    total,
    successRate: parseFloat(successRate.toFixed(2)),
    averageProcessingTime: 'Not available (requires redis-TimeSeries integration)',
  };
}
