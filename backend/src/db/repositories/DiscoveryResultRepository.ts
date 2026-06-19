import { supabase } from '../../config/supabase.js';

export interface DiscoveryResultInput {
  job_id: string;
  source: string;
  raw_name?: string;
  raw_phone?: string;
  raw_email?: string;
  raw_website?: string;
  raw_address?: string;
  raw_rating?: string;
  raw_data?: Record<string, any>;
}

export class DiscoveryResultRepository {
  async bulkInsert(results: DiscoveryResultInput[]) {
    if (results.length === 0) return [];

    // Supabase has a limit on batch inserts; chunk into groups of 500
    const CHUNK_SIZE = 500;
    const allInserted: any[] = [];

    for (let i = 0; i < results.length; i += CHUNK_SIZE) {
      const chunk = results.slice(i, i + CHUNK_SIZE);
      const { data, error } = await supabase
        .from('discovery_results')
        .insert(chunk)
        .select();

      if (error) {
        console.error('Error bulk inserting discovery results:', error);
        throw error;
      }
      if (data) {
        allInserted.push(...data);
      }
    }

    return allInserted;
  }

  async getByJobId(jobId: string, includeDeduplicates = false) {
    let query = supabase
      .from('discovery_results')
      .select(`
        *,
        companies (
          id,
          name,
          website_url,
          phone,
          industry,
          status,
          lead_score,
          pipeline_stage
        )
      `)
      .eq('job_id', jobId)
      .order('created_at', { ascending: true });

    if (!includeDeduplicates) {
      query = query.eq('is_duplicate', false);
    }

    const { data, error } = await query;

    if (error) {
      console.error(`Error fetching results for job ${jobId}:`, error);
      throw error;
    }
    return data || [];
  }

  async markDuplicate(resultId: string, duplicateOfId: string) {
    const { data, error } = await supabase
      .from('discovery_results')
      .update({ is_duplicate: true, duplicate_of: duplicateOfId })
      .eq('id', resultId)
      .select()
      .single();

    if (error) {
      console.error(`Error marking result ${resultId} as duplicate:`, error);
      throw error;
    }
    return data;
  }

  async bulkMarkDuplicates(duplicatePairs: { resultId: string; duplicateOfId: string }[]) {
    for (const pair of duplicatePairs) {
      await this.markDuplicate(pair.resultId, pair.duplicateOfId);
    }
  }

  async linkCompany(resultId: string, companyId: string, extraData?: Record<string, any>) {
    let updatePayload: any = { company_id: companyId };

    if (extraData) {
      // fetch current raw_data to merge
      const { data: currentResult } = await supabase
        .from('discovery_results')
        .select('raw_data')
        .eq('id', resultId)
        .single();

      if (currentResult) {
        updatePayload.raw_data = {
          ...(currentResult.raw_data || {}),
          ...extraData
        };
      }
    }

    const { data, error } = await supabase
      .from('discovery_results')
      .update(updatePayload)
      .eq('id', resultId)
      .select()
      .single();

    if (error) {
      console.error(`Error linking result ${resultId} to company ${companyId}:`, error);
      throw error;
    }
    return data;
  }

  async getUniqueResults(jobId: string) {
    const { data, error } = await supabase
      .from('discovery_results')
      .select('*')
      .eq('job_id', jobId)
      .eq('is_duplicate', false)
      .order('created_at', { ascending: true });

    if (error) {
      console.error(`Error fetching unique results for job ${jobId}:`, error);
      throw error;
    }
    return data || [];
  }

  async getResultsWithCompanies(jobId: string) {
    const { data, error } = await supabase
      .from('discovery_results')
      .select(`
        *,
        companies (
          id,
          name,
          website_url,
          phone,
          industry,
          status,
          lead_score,
          pipeline_stage
        )
      `)
      .eq('job_id', jobId)
      .eq('is_duplicate', false)
      .order('created_at', { ascending: true });

    if (error) {
      console.error(`Error fetching results with companies for job ${jobId}:`, error);
      throw error;
    }
    return data || [];
  }
}
