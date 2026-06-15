import { Ollama } from 'ollama';
import { supabase } from '../config/supabase.js';

export class AgentService {
  private ollama: Ollama;

  constructor() {
    this.ollama = new Ollama({ host: 'http://127.0.0.1:11434' });
  }

  async generateResponse(companyId: string, message: string, model: string = 'qwen3:8b') {
    // 1. Fetch Company Context
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select(`
        *,
        company_intelligence (
          lead_score,
          digital_maturity_score,
          services_needed,
          website_score,
          crm_detected,
          whatsapp_detected,
          booking_detected,
          social_profiles,
          pain_points,
          opportunities,
          ai_insight
        )
      `)
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      throw new Error(`Failed to fetch company context: ${companyError?.message}`);
    }

    const intel = company.company_intelligence?.[0] || {};
    
    // 2. Build System Prompt
    const systemPrompt = `You are an elite B2B AI Sales Assistant for LeadEngine. 
Your goal is to help draft outreach messages, analyze company signals, and suggest next steps.
Always be concise, professional, and persuasive.

Context about the target company:
- Name: ${company.name}
- Industry: ${company.industry || 'Unknown'}
- Website: ${company.website_url || 'Unknown'}
- Lead Score: ${intel.lead_score || 'N/A'}
- Digital Maturity: ${intel.digital_maturity_score || 'N/A'}
- Recommended Services: ${(intel.services_needed || []).join(', ')}
- Pain Points: ${(intel.pain_points || []).join(', ')}
- Opportunities: ${(intel.opportunities || []).join(', ')}

Guidelines:
- If asked to write an email, write ONLY the email body and subject line. Do not include boilerplate intro/outro text outside the email.
- If asked to write a WhatsApp message, keep it short, casual but professional, and use appropriate emojis.
- If asked for a proposal summary, synthesize the pain points and opportunities.
- If asked for next actions, provide 2-3 concrete bullet points based on their digital maturity.`;

    // 3. Call Ollama
    try {
      const response = await this.ollama.chat({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        stream: false
      });

      return {
        response: response.message.content,
        model: response.model
      };
    } catch (err: any) {
      console.error('Ollama Error:', err);
      throw new Error(`Failed to communicate with LLM: ${err.message}`);
    }
  }
}
