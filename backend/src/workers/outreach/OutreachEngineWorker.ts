import { Worker, Job } from 'bullmq';
import { redisConfig } from '../../config/redis.js';
import { CampaignRepository } from '../../db/repositories/CampaignRepository.js';
import { failedOutreachQueue } from '../../orchestration/Queues.js';

const repository = new CampaignRepository();

export const outreachWorker = new Worker(
  'outreach-engine-queue',
  async (job: Job) => {
    console.log(`[OutreachEngine] Processing outreach tick...`);

    // 1. Fetch due enrollments (simulated tick logic for all active enrollments)
    const dueEnrollments = await repository.getDueEnrollments();

    if (!dueEnrollments || dueEnrollments.length === 0) {
      console.log(`[OutreachEngine] No active enrollments due.`);
      return { processed: 0 };
    }

    console.log(`[OutreachEngine] Found ${dueEnrollments.length} due enrollments.`);

    let processedCount = 0;

    for (const enrollment of dueEnrollments) {
      try {
        const step = await repository.getCampaignStep(enrollment.campaign_id, enrollment.current_step_number);

        if (!step) {
          // No more steps, complete the sequence
          await repository.updateEnrollment(enrollment.id, { status: 'completed' });
          console.log(`[OutreachEngine] Enrollment ${enrollment.id} completed.`);
          continue;
        }

        // 2. Generate Message and Activity
        const contactId = enrollment.contact_id;
        const companyId = enrollment.company_id;
        const campaignId = enrollment.campaign_id;
        
        // Personalize body (rudimentary simulation)
        const contactName = enrollment.contacts?.first_name || 'there';
        const body = step.template_body.replace('{{name}}', contactName);
        const subject = step.template_subject ? step.template_subject.replace('{{name}}', contactName) : null;

        await repository.recordMessageAndActivity(
          campaignId,
          contactId,
          companyId,
          step.channel,
          subject,
          body
        );

        // 3. Update Aggregate Metrics (Simulate Send/Open/Click randomly to showcase UI)
        await repository.incrementCampaignStat(campaignId, 'sent_count', 1);

        // Randomly simulate opens/replies to make dashboard look alive
        const rand = Math.random();
        if (rand > 0.5) await repository.incrementCampaignStat(campaignId, 'opened_count', 1);
        if (rand > 0.7) await repository.incrementCampaignStat(campaignId, 'clicked_count', 1);
        if (rand > 0.9) {
          await repository.incrementCampaignStat(campaignId, 'replied_count', 1);
          // Auto-pause if replied
          await repository.updateEnrollment(enrollment.id, { status: 'replied' });
        }

        // 4. Update Enrollment State
        if (enrollment.status === 'active') { // Check if it wasn't replied to above
          await repository.updateEnrollment(enrollment.id, {
            current_step_number: enrollment.current_step_number + 1,
            last_processed_at: new Date().toISOString()
          });
        }

        processedCount++;
        console.log(`[OutreachEngine] Processed step ${step.step_number} for enrollment ${enrollment.id}`);
      } catch (error) {
        console.error(`[OutreachEngine] Failed to process enrollment ${enrollment.id}:`, error);
        // We could move to DLQ or mark failed here.
      }
    }

    return { processed: processedCount };
  },
  {
    connection: redisConfig,
    concurrency: 1, // Ensure sequential processing per tick
  }
);

outreachWorker.on('failed', async (job: Job | undefined, err: Error) => {
  console.error(`[OutreachEngine] Job failed:`, err);
  if (job) {
    await failedOutreachQueue.add('failed-outreach-job', {
      originalJob: job.data,
      error: err.message,
    });
  }
});
