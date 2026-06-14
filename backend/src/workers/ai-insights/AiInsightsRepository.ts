import { SupabaseClient } from '@supabase/supabase-js';
import { CompanyAiInsightRecord } from './AiInsightsTypes.js';

export class AiInsightsRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async saveInsight(record: CompanyAiInsightRecord): Promise<CompanyAiInsightRecord> {
    const { error, data } = await this.supabase
      .from('company_ai_insights')
      .upsert(
        {
          company_id: record.company_id,
          summary: record.summary,
          opportunity_score: record.opportunity_score,
          services_needed: record.services_needed,
          reasoning: record.reasoning,
          recommended_next_action: record.recommended_next_action,
          model_used: record.model_used,
        },
        { onConflict: 'company_id' }
      )
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save AI Insight: ${error.message}`);
    }

    return data as CompanyAiInsightRecord;
  }

  async getInsightByCompanyId(companyId: string): Promise<CompanyAiInsightRecord | null> {
    const { data, error } = await this.supabase
      .from('company_ai_insights')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch AI Insight: ${error.message}`);
    }

    return data as CompanyAiInsightRecord | null;
  }
}
