import { Request, Response } from 'express';
import { bulkAnalyzeSchema } from '../schemas/discovery.schema.js';
import { OrchestratorService } from '../../orchestration/OrchestratorService.js';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../../config/supabase.js';

export class BulkAnalyzeController {
  /**
   * Start the full orchestration workflow for a batch of discovery results.
   */
  static async bulkAnalyze(req: Request, res: Response) {
    try {
      const input = bulkAnalyzeSchema.parse(req.body);
      
      const batchId = uuidv4();
      let startedCount = 0;

      // We run this asynchronously so we don't block the API response
      // Fire and forget for the orchestration triggers
      (async () => {
        for (const resultId of input.resultIds) {
          try {
            const { data: result } = await supabase
              .from('discovery_results')
              .select('*')
              .eq('id', resultId)
              .single();
              
            if (!result) continue;

            let companyId = result.company_id;

            if (!companyId) {
              const { data: company, error } = await supabase
                .from('companies')
                .insert([{
                  name: result.raw_name || 'Unknown',
                  website_url: result.raw_website || null,
                  phone: result.raw_phone || null,
                  status: 'prospect'
                }])
                .select()
                .single();
                
              if (company) {
                companyId = company.id;
                await supabase
                  .from('discovery_results')
                  .update({ company_id: companyId })
                  .eq('id', resultId);
              }
            }

            if (companyId) {
              await OrchestratorService.startCompanyWorkflow(companyId);
              startedCount++;
            }
          } catch (err) {
            console.error(`Failed to start workflow for result ${resultId}:`, err);
          }
        }
        console.log(`Bulk analyze batch ${batchId} triggered ${startedCount}/${input.resultIds.length} workflows.`);
      })();

      res.status(202).json({
        message: 'Bulk analysis started',
        batchId,
        totalRequested: input.resultIds.length,
      });
    } catch (error: any) {
      console.error('Error starting bulk analysis:', error);
      res.status(400).json({ error: error.message || 'Validation error' });
    }
  }
}
