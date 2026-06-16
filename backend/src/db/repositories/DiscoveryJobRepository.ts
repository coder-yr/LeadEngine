import { supabase } from '../../config/supabase.js';

export interface DiscoveryJobInput {
  keyword: string;
  city: string;
  sources: string[];
}

export interface DiscoveryJobUpdate {
  status?: string;
  total_raw_results?: number;
  total_after_dedup?: number;
  total_companies_created?: number;
  error_message?: string;
  per_source_counts?: Record<string, number>;
  started_at?: string;
  completed_at?: string;
}

export class DiscoveryJobRepository {
  async create(input: DiscoveryJobInput) {
    const { data, error } = await supabase
      .from('discovery_jobs')
      .insert([{
        keyword: input.keyword,
        city: input.city,
        sources: input.sources,
        status: 'pending',
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating discovery job:', error);
      throw error;
    }
    return data;
  }

  async updateStatus(jobId: string, updates: DiscoveryJobUpdate) {
    const { data, error } = await supabase
      .from('discovery_jobs')
      .update(updates)
      .eq('id', jobId)
      .select()
      .single();

    if (error) {
      console.error(`Error updating discovery job ${jobId}:`, error);
      throw error;
    }
    return data;
  }

  async getById(jobId: string) {
    const { data, error } = await supabase
      .from('discovery_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) {
      console.error(`Error fetching discovery job ${jobId}:`, error);
      throw error;
    }
    return data;
  }

  async getAll(limit = 50, offset = 0) {
    const { data, error, count } = await supabase
      .from('discovery_jobs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching discovery jobs:', error);
      throw error;
    }
    return { data: data || [], total: count || 0 };
  }

  async getByStatus(status: string) {
    const { data, error } = await supabase
      .from('discovery_jobs')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`Error fetching discovery jobs by status ${status}:`, error);
      throw error;
    }
    return data || [];
  }

  async deleteJob(jobId: string) {
    const { error } = await supabase
      .from('discovery_jobs')
      .delete()
      .eq('id', jobId);

    if (error) {
      console.error(`Error deleting discovery job ${jobId}:`, error);
      throw error;
    }
  }

  async getStats() {
    const { data: jobs, error } = await supabase
      .from('discovery_jobs')
      .select('status, total_raw_results, total_after_dedup, total_companies_created');

    if (error) {
      console.error('Error fetching discovery stats:', error);
      throw error;
    }

    const stats = {
      totalJobs: jobs?.length || 0,
      completedJobs: jobs?.filter(j => j.status === 'completed').length || 0,
      failedJobs: jobs?.filter(j => j.status === 'failed').length || 0,
      runningJobs: jobs?.filter(j => j.status === 'running').length || 0,
      totalDiscovered: jobs?.reduce((sum, j) => sum + (j.total_raw_results || 0), 0) || 0,
      totalAfterDedup: jobs?.reduce((sum, j) => sum + (j.total_after_dedup || 0), 0) || 0,
      totalCompaniesCreated: jobs?.reduce((sum, j) => sum + (j.total_companies_created || 0), 0) || 0,
    };

    return stats;
  }
}
