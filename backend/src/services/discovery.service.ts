import { DiscoveryJobRepository, DiscoveryJobInput } from '../db/repositories/DiscoveryJobRepository.js';
import { DiscoveryResultRepository, DiscoveryResultInput } from '../db/repositories/DiscoveryResultRepository.js';
import { CompanyRepository } from '../db/repositories/CompanyRepository.js';
import { DeduplicationService, RawDiscoveryRecord } from './DeduplicationService.js';
import { OrchestratorService } from '../orchestration/OrchestratorService.js';
import { WebsiteNormalizationService } from './WebsiteNormalizationService.js';
import { discoveryExecuteQueue } from '../orchestration/Queues.js';

export interface DiscoveryRunnerOutput {
  status: string;
  results: Array<{
    'Business Name'?: string;
    Phone?: string;
    Email?: string;
    Website?: string;
    Address?: string;
    Rating?: string;
    source: string;
    [key: string]: any;
  }>;
  errors?: Array<{ source: string; error: string }>;
  total_raw?: number;
  per_source?: Record<string, number>;
}

export class DiscoveryService {
  private jobRepo = new DiscoveryJobRepository();
  private resultRepo = new DiscoveryResultRepository();
  private companyRepo = new CompanyRepository();
  private dedupService = new DeduplicationService();
  private websiteNormalizer = new WebsiteNormalizationService();

  /**
   * Start a new discovery job.
   * Creates the job record and enqueues to Python workers.
   */
  async startDiscovery(input: DiscoveryJobInput): Promise<string> {
    // 1. Create job record
    const jobRecord = await this.jobRepo.create(input);
    const jobId = jobRecord.id;

    // 2. Add job to execution queue
    const payload = {
      jobId,
      pipelineId: jobId, // Root of pipeline
      keyword: input.keyword,
      city: input.city,
      sources: input.sources,
      max_results: input.max_results || 50,
    };
    
    await discoveryExecuteQueue.add('run-discovery', payload);
    
    // Update status to running
    await this.jobRepo.updateStatus(jobId, {
      status: 'running',
      started_at: new Date().toISOString(),
    });

    return jobId;
  }

  /**
   * Called by the DiscoveryCompletedWorker when Python finishes execution.
   */
  async processDiscoveryResults(jobId: string, runnerOutput: DiscoveryRunnerOutput): Promise<void> {
    const job = await this.jobRepo.getById(jobId);
    
    if (!job) {
      console.warn(`[Discovery Service] Job ${jobId} not found (likely deleted). Aborting pipeline.`);
      return;
    }

    if (runnerOutput.status === 'error') {
      await this.jobRepo.updateStatus(jobId, {
        status: 'failed',
        error_message: runnerOutput.errors?.[0]?.error || 'Unknown Python error',
        completed_at: new Date().toISOString(),
      });
      throw new Error(`Discovery runner error: ${runnerOutput.errors?.[0]?.error || 'Unknown error'}`);
    }

    // 1.5. Normalize directory URLs
    for (const r of runnerOutput.results) {
      if (r.Website && this.websiteNormalizer.isDirectoryDomain(r.Website)) {
        console.log(`[Discovery Pipeline] Directory URL detected: ${r.Website}`);
        const officialWeb = await this.websiteNormalizer.extractOfficialWebsite(r.Website);
        if (officialWeb) {
          console.log(`[Discovery Pipeline] Successfully extracted official website: ${officialWeb}`);
          r.Website = officialWeb;
        }
      }
    }

    // 2. Bulk-insert raw results into discovery_results
    const resultInputs: DiscoveryResultInput[] = runnerOutput.results.map((r) => ({
      job_id: jobId,
      source: r.source,
      raw_name: r['Business Name'] || r['Contact Person'] || undefined,
      raw_phone: r.Phone || undefined,
      raw_email: r.Email || undefined,
      raw_website: r.Website || undefined,
      raw_address: r.Address || undefined,
      raw_rating: r.Rating || undefined,
      raw_data: r,
    }));

    const insertedResults = await this.resultRepo.bulkInsert(resultInputs);

    // Update per-source counts
    await this.jobRepo.updateStatus(jobId, {
      total_raw_results: insertedResults.length,
      per_source_counts: runnerOutput.per_source || {},
    });

    // 3. Run deduplication
    const records: RawDiscoveryRecord[] = insertedResults.map((r: any) => ({
      id: r.id,
      raw_name: r.raw_name,
      raw_phone: r.raw_phone,
      raw_website: r.raw_website,
      raw_address: r.raw_address,
      source: r.source,
    }));

    const dedupResult = this.dedupService.deduplicate(records);

    // Mark duplicates in DB
    if (dedupResult.duplicatePairs.length > 0) {
      await this.resultRepo.bulkMarkDuplicates(dedupResult.duplicatePairs);
    }

    await this.jobRepo.updateStatus(jobId, {
      total_after_dedup: dedupResult.totalAfterDedup,
    });

    // 4. Create companies from unique results (with deduplication against existing DB)
    let companiesCreated = 0;
    let attemptedCompanies = 0;
    let skippedCompanies = 0;
    let skipReasons: Record<string, number> = {};
    
    const existingCompanies = await this.companyRepo.getAllCompanies();

    for (const record of dedupResult.uniqueRecords) {
      attemptedCompanies++;
      try {
        const match = this.dedupService.findBestMatch(record, existingCompanies);

        if (match) {
          skippedCompanies++;
          const reasonKey = `${match.reason} (DeduplicationService)`;
          skipReasons[reasonKey] = (skipReasons[reasonKey] || 0) + 1;

          await this.resultRepo.linkCompany(record.id, match.company.id, {
            match_confidence: match.confidence,
            matched_existing: true
          });
        } else {
          const company = await this.companyRepo.create({
            name: record.raw_name || 'Unknown',
            website_url: record.raw_website || undefined,
            phone: record.raw_phone || undefined,
            status: 'prospect',
            discovery_job_id: jobId,
            discovery_source: record.source,
          });

          await this.resultRepo.linkCompany(record.id, company.id, {
            match_confidence: 1.0,
            is_new_company: true
          });
          
          existingCompanies.push(company);
          companiesCreated++;

          // 5. Start orchestration workflow for each new company
          await OrchestratorService.startCompanyWorkflow(company.id);
        }
      } catch (err: any) {
        skippedCompanies++;
        if (err.code === 'DUPLICATE_PHONE') skipReasons['Duplicate Phone (DB Constraint)'] = (skipReasons['Duplicate Phone (DB Constraint)'] || 0) + 1;
        else if (err.code === 'DUPLICATE_WEBSITE') skipReasons['Duplicate Website (DB Constraint)'] = (skipReasons['Duplicate Website (DB Constraint)'] || 0) + 1;
        else skipReasons['Unknown Error'] = (skipReasons['Unknown Error'] || 0) + 1;
      }
    }

    // 6. Update job as completed
    await this.jobRepo.updateStatus(jobId, {
      status: 'completed',
      total_companies_created: companiesCreated,
      completed_at: new Date().toISOString(),
    });
  }
}
