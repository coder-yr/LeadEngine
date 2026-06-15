import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { 
  intelligenceQueue, 
  websiteAuditQueue, 
  aiInsightsQueue,
  buyingSignalsQueue,
  outreachQueue,
  failedIntelligenceQueue,
  failedAuditQueue,
  failedInsightsQueue,
  failedBuyingSignalsQueue,
  failedOutreachQueue
} from './Queues.js';

export const bullBoardAdapter = new ExpressAdapter();
bullBoardAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [
    new BullMQAdapter(intelligenceQueue),
    new BullMQAdapter(websiteAuditQueue),
    new BullMQAdapter(buyingSignalsQueue),
    new BullMQAdapter(outreachQueue),
    new BullMQAdapter(aiInsightsQueue),
    new BullMQAdapter(failedIntelligenceQueue),
    new BullMQAdapter(failedAuditQueue),
    new BullMQAdapter(failedBuyingSignalsQueue),
    new BullMQAdapter(failedOutreachQueue),
    new BullMQAdapter(failedInsightsQueue),
  ],
  serverAdapter: bullBoardAdapter,
});
