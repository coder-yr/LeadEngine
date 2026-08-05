import { Worker, Job } from 'bullmq';
import { spawn } from 'child_process';
import path from 'path';
import { redisConfig } from '../../config/redis.js';
import { supabase } from '../../config/supabase.js';
import { createTraceLogger } from '../../utils/logger.js';
import { StageDispatcher } from '../../orchestration/StageDispatcher.js';
import { DiscoveryStage } from '../../services/IdentityResolutionService.js';

const workerOptions = {
  connection: redisConfig,
  concurrency: 4,
};

export const websiteIntelligenceWorker = new Worker(
  'website-intelligence-queue',
  async (job: Job<{ leadIdentityId: string; companyId?: string; traceId?: string; stage: DiscoveryStage }>) => {
    const { leadIdentityId, companyId, traceId, stage } = job.data;
    const { logger } = createTraceLogger(traceId || leadIdentityId);
    
    logger.info({ leadIdentityId, stage }, 'Starting website intelligence pipeline');

    // 1. Get identity details
    const { data: identity } = await supabase
      .from('lead_identities')
      .select('normalized_domain')
      .eq('id', leadIdentityId)
      .maybeSingle();

    if (!identity || !identity.normalized_domain) {
      logger.warn({ leadIdentityId }, 'No domain found for lead identity, skipping website intelligence');
      await StageDispatcher.advance(leadIdentityId, stage, {
        supabase,
        companyId,
        traceId,
        metadata: { success: false, errorMessage: 'No domain found' },
      });
      return { skipped: true, reason: 'No domain found' };
    }

    const url = `https://${identity.normalized_domain}`;

    // 2. Call Python Website Intelligence Runner
    const pythonPath = process.env.PYTHON_PATH || path.resolve(process.cwd(), '../workers/venv/Scripts/python.exe');
    const scriptPath = path.resolve(process.cwd(), '../workers/src/website_runner.py');

    const result = await new Promise<any>((resolve, reject) => {
      const py = spawn(pythonPath, [scriptPath]);
      let output = '';
      let errorOut = '';

      py.stdout.on('data', (data) => {
        output += data.toString();
      });

      py.stderr.on('data', (data) => {
        errorOut += data.toString();
      });

      py.on('close', (code) => {
        if (code !== 0) {
          logger.error({ errorOut }, 'Website Intelligence Python script failed');
          return reject(new Error(`Python process exited with code ${code}`));
        }
        try {
          resolve(JSON.parse(output));
        } catch (e) {
          reject(new Error(`Failed to parse Python output: ${e}`));
        }
      });

      py.stdin.write(JSON.stringify({ url }));
      py.stdin.end();
    });

    if (result.status === 'error' || result.status === 'failed') {
      logger.warn({ leadIdentityId, error: result.error }, 'Website Intelligence failed');
      await StageDispatcher.advance(leadIdentityId, stage, {
        supabase,
        companyId,
        traceId,
        metadata: { success: false, errorMessage: result.error },
      });
      return result;
    }

    // 3. Save Website Document to DB (Provenance)
    // For now we store the full document in a JSONB column on lead_identities
    const doc = result.document;
    await supabase
      .from('lead_identities')
      .update({
        website_document: doc,
        updated_at: new Date().toISOString(),
      })
      .eq('id', leadIdentityId);

    // Also update legacy company fields if linked
    if (companyId) {
      const legacy = result.legacy;
      await supabase.from('companies').update({
        has_website: true,
        has_contact_form: legacy.has_contact_form,
        has_whatsapp_widget: legacy.has_whatsapp_widget,
        has_booking_system: legacy.has_booking_system,
        has_crm: legacy.has_crm_integration,
      }).eq('id', companyId);
    }

    // 4. Advance Stage
    await StageDispatcher.advance(leadIdentityId, stage, {
      supabase,
      companyId,
      traceId,
      metadata: { success: true },
    });

    return result;
  },
  workerOptions
);
