import { spawn } from 'child_process';
import path from 'path';
import { DiscoveryJobRepository, DiscoveryJobInput } from '../db/repositories/DiscoveryJobRepository.js';
import { DiscoveryResultRepository, DiscoveryResultInput } from '../db/repositories/DiscoveryResultRepository.js';
import { CompanyRepository } from '../db/repositories/CompanyRepository.js';
import { DeduplicationService, RawDiscoveryRecord } from './DeduplicationService.js';
import { OrchestratorService } from '../orchestration/OrchestratorService.js';

import fs from 'fs';

const WORKERS_DIR = path.resolve(process.cwd(), '..', 'workers', 'src');

let PYTHON_PATH = process.env.PYTHON_PATH || '';
if (!PYTHON_PATH) {
  const venvWin = path.resolve(process.cwd(), '..', 'workers', 'venv', 'Scripts', 'python.exe');
  const venvLinux = path.resolve(process.cwd(), '..', 'workers', 'venv', 'bin', 'python');
  if (fs.existsSync(venvWin)) PYTHON_PATH = venvWin;
  else if (fs.existsSync(venvLinux)) PYTHON_PATH = venvLinux;
  else PYTHON_PATH = 'python';
}

interface DiscoveryRunnerOutput {
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
  errors: Array<{ source: string; error: string }>;
  total_raw: number;
  per_source: Record<string, number>;
}

export class DiscoveryService {
  private jobRepo = new DiscoveryJobRepository();
  private resultRepo = new DiscoveryResultRepository();
  private companyRepo = new CompanyRepository();
  private dedupService = new DeduplicationService();

  /**
   * Start a new discovery job.
   * Creates the job record, spawns the Python runner, processes results.
   */
  async startDiscovery(input: DiscoveryJobInput): Promise<string> {
    // 1. Create job record
    const job = await this.jobRepo.create(input);
    const jobId = job.id;

    // 2. Run the pipeline asynchronously
    this.runPipeline(jobId, input).catch((err) => {
      console.error(`Discovery pipeline failed for job ${jobId}:`, err);
      this.jobRepo.updateStatus(jobId, {
        status: 'failed',
        error_message: err.message || String(err),
        completed_at: new Date().toISOString(),
      });
    });

    return jobId;
  }

  /**
   * Full discovery pipeline: scrape → store → dedup → create companies → orchestrate
   */
  private async runPipeline(jobId: string, input: DiscoveryJobInput): Promise<void> {
    // Update status to running
    await this.jobRepo.updateStatus(jobId, {
      status: 'running',
      started_at: new Date().toISOString(),
    });

    // 1. Run Python discovery runner
    const runnerOutput = await this.spawnDiscoveryRunner({
      keyword: input.keyword,
      city: input.city,
      sources: input.sources,
      max_results: 50,
    });

    if (runnerOutput.status === 'error') {
      throw new Error(`Discovery runner error: ${runnerOutput.errors?.[0]?.error || 'Unknown error'}`);
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
      per_source_counts: runnerOutput.per_source,
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

    // 4. Create companies from unique results
    let companiesCreated = 0;

    for (const record of dedupResult.uniqueRecords) {
      try {
        const company = await this.companyRepo.create({
          name: record.raw_name || 'Unknown',
          website_url: record.raw_website || undefined,
          phone: record.raw_phone || undefined,
          industry: undefined,
          description: undefined,
          status: 'prospect',
        });

        // Link the discovery result to the company
        await this.resultRepo.linkCompany(record.id, company.id);
        companiesCreated++;

        // 5. Start orchestration workflow for each new company
        await OrchestratorService.startCompanyWorkflow(company.id);
      } catch (err) {
        console.error(`Failed to create company from result ${record.id}:`, err);
      }
    }

    // 6. Update job as completed
    await this.jobRepo.updateStatus(jobId, {
      status: 'completed',
      total_companies_created: companiesCreated,
      completed_at: new Date().toISOString(),
    });
  }

  /**
   * Spawn the Python discovery runner script and capture JSON output.
   */
  private spawnDiscoveryRunner(config: Record<string, any>): Promise<DiscoveryRunnerOutput> {
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn(PYTHON_PATH, ['discovery_runner.py'], {
        cwd: WORKERS_DIR,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        // Log Python stderr (it contains logging output)
        console.log(`[Discovery Python] ${data.toString().trim()}`);
      });

      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          console.error(`Discovery runner exited with code ${code}`);
          console.error(`stderr: ${stderr}`);
          reject(new Error(`Discovery runner exited with code ${code}: ${stderr.slice(-500)}`));
          return;
        }

        try {
          const output = JSON.parse(stdout);
          resolve(output as DiscoveryRunnerOutput);
        } catch (parseError) {
          reject(new Error(`Failed to parse discovery runner output: ${parseError}`));
        }
      });

      pythonProcess.on('error', (err) => {
        reject(new Error(`Failed to spawn discovery runner: ${err.message}`));
      });

      // Send config as JSON via stdin
      pythonProcess.stdin.write(JSON.stringify(config));
      pythonProcess.stdin.end();
    });
  }
}
