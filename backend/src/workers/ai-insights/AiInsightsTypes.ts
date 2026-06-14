export interface AiInsightResult {
  summary: string;
  opportunityScore: number;
  servicesNeeded: string[];
  reasoning: string;
  recommendedNextAction: string;
}

export interface CompanyAiInsightRecord {
  id?: string;
  company_id: string;
  summary: string;
  opportunity_score: number;
  services_needed: string[];
  reasoning: string;
  recommended_next_action: string;
  model_used: string;
  created_at?: Date;
  updated_at?: Date;
}
