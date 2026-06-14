import { Worker, Job } from 'bullmq';
import { AuditService } from './AuditService.js';
import { AuditRepository } from './AuditRepository.js';

const connection = {
  host: process.env.BULLMQ_REDIS_HOST || 'localhost',
  port: parseInt(process.env.BULLMQ_REDIS_PORT || '6379')
};

const auditService = new AuditService();
const auditRepository = new AuditRepository();

const worker = new Worker(
  'website-audit-queue',
  async (job: Job<{ companyId: string, url?: string }>) => {
    console.log(`Processing audit job for company ${job.data.companyId}`);
    
    let url = job.data.url;
    if (!url) {
      const website = await auditRepository.getCompanyWebsite(job.data.companyId);
      if (!website) {
        console.warn(`Company ${job.data.companyId} has no website. Skipping audit.`);
        return;
      }
      url = website;
    }

    try {
      const result = await auditService.auditWebsite(url);
      await auditRepository.saveAuditResult(job.data.companyId, result);
      console.log(`Successfully audited website for company ${job.data.companyId}`);
    } catch (error) {
      console.error(`Error auditing company ${job.data.companyId}:`, error);
      throw error;
    }
  },
  { connection }
);

worker.on('failed', (job, err) => {
  console.error(`Audit Job ${job?.id} failed:`, err.message);
});

console.log('Website Audit worker started, listening to website-audit-queue...');
