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

    const industry = company.industry || 'General Business';
    
    let industryContext = '';
    if (industry.toLowerCase().includes('retail') || industry.toLowerCase().includes('e-commerce') || industry.toLowerCase().includes('wholesale')) {
      industryContext = 'For Retail/Wholesale/E-commerce, suggest services like Inventory Management, POS Integration, and E-commerce Platforms.';
    } else if (industry.toLowerCase().includes('manufacturing')) {
      industryContext = 'For Manufacturing, suggest services like ERP Integration, Supply Chain Management Software, and B2B Portals.';
    } else if (industry.toLowerCase().includes('hospitality')) {
      industryContext = 'For Hospitality, suggest services like Booking Systems, Guest Portals, and Loyalty Programs.';
    } else if (industry.toLowerCase().includes('real estate')) {
      industryContext = 'For Real Estate, suggest services like Property Listing Portals, Virtual Tours, and CRM for Agents.';
    } else if (industry.toLowerCase().includes('healthcare')) {
      industryContext = 'For Healthcare, suggest services like Patient Portals, Telemedicine Integration, and HIPAA-compliant CRM.';
    } else {
      industryContext = 'Suggest services like Website Development, CRM Development, WhatsApp Automation, AI Chatbot, and SEO depending on their gaps.';
    }

    // 2. Construct Prompt
    const prompt = `
You are an elite Senior SaaS Sales Consultant. Analyze the following prospect data and provide strategic insights.

COMPANY PROFILE:
Name: ${company.name}
Domain: ${company.website_url || 'N/A'}
Industry: ${industry}

INTELLIGENCE DATA:
${JSON.stringify(company.company_intelligence || {}, null, 2)}

WEBSITE AUDIT DATA:
${JSON.stringify(company.website_audits || {}, null, 2)}

Analyze their digital maturity and integration gaps based on the audit data.
${industryContext}

Provide your analysis strictly in the following JSON format:
{
  "summary": "A brief 2-3 sentence summary of their digital state tailored to their industry.",
  "opportunityScore": <integer 0-100, where 100 means they need everything>,
  "servicesNeeded": ["Service 1", "Service 2"],
  "reasoning": "Why you scored them this way and recommended these services.",
  "recommendedNextAction": "What the sales rep should do next (e.g., 'Send cold email pitching an ERP system')."
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
