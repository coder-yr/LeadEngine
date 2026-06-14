import { SupabaseClient } from '@supabase/supabase-js';
import { Ollama } from 'ollama';
import { AiInsightsRepository } from './AiInsightsRepository.js';
import { AiInsightResult } from './AiInsightsTypes.js';

export class AiInsightsService {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly repository: AiInsightsRepository,
    private readonly ollamaClient: Ollama = new Ollama({ host: 'http://localhost:11434' })
  ) {}

  async generateInsight(companyId: string, model: string = 'qwen3:8b') {
    // 1. Fetch Company Data
    const { data: company, error } = await this.supabase
      .from('companies')
      .select(`
        *,
        company_intelligence (*),
        website_audits (*)
      `)
      .eq('id', companyId)
      .single();

    if (error || !company) {
      throw new Error(`Failed to fetch company data: ${error?.message || 'Company not found'}`);
    }

    // 2. Construct Prompt
    const prompt = `
You are an elite Senior SaaS Sales Consultant. Analyze the following prospect data and provide strategic insights.

COMPANY PROFILE:
Name: ${company.name}
Domain: ${company.domain || 'N/A'}

INTELLIGENCE DATA:
${JSON.stringify(company.company_intelligence || {}, null, 2)}

WEBSITE AUDIT DATA:
${JSON.stringify(company.website_audits || {}, null, 2)}

Analyze their digital maturity and integration gaps (e.g., missing CRM, WhatsApp, Contact Forms, poor SEO).
Determine what services we should pitch them (e.g., "Website Development", "CRM Development", "WhatsApp Automation", "AI Chatbot", "SEO").

Provide your analysis strictly in the following JSON format:
{
  "summary": "A brief 2-3 sentence summary of their digital state.",
  "opportunityScore": <integer 0-100, where 100 means they need everything>,
  "servicesNeeded": ["Service 1", "Service 2"],
  "reasoning": "Why you scored them this way and recommended these services.",
  "recommendedNextAction": "What the sales rep should do next (e.g., 'Send cold email pitching a new website')."
}
`;

    // 3. Call Ollama
    let responseText = '';
    try {
      const response = await this.ollamaClient.generate({
        model: model,
        prompt: prompt,
        format: 'json',
        stream: false,
      });
      responseText = response.response;
    } catch (ollamaError: any) {
      throw new Error(`Ollama API Error: ${ollamaError.message}`);
    }

    // 4. Parse Result
    let result: AiInsightResult;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      throw new Error('Failed to parse Ollama JSON response');
    }

    // Validate structure roughly
    if (typeof result.opportunityScore !== 'number' || !Array.isArray(result.servicesNeeded)) {
       throw new Error('Ollama returned invalid JSON schema');
    }

    // 5. Save Insight
    return await this.repository.saveInsight({
      company_id: companyId,
      summary: result.summary,
      opportunity_score: result.opportunityScore,
      services_needed: result.servicesNeeded,
      reasoning: result.reasoning,
      recommended_next_action: result.recommendedNextAction,
      model_used: model
    });
  }
}
