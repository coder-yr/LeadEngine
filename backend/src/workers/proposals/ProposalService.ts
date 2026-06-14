import { SupabaseClient } from '@supabase/supabase-js';
import { ProposalRequest, ProposalContent, ProposalType } from './ProposalTypes.js';
import { PdfGenerator } from './PdfGenerator.js';
import { randomUUID } from 'crypto';

export class ProposalService {
  constructor(private readonly supabase: SupabaseClient) {}

  async generateProposal(request: ProposalRequest): Promise<{ url: string; fileName: string }> {
    // 1. Fetch Company Data including AI Insights
    const { data: company, error } = await this.supabase
      .from('companies')
      .select(`
        *,
        company_ai_insights (*),
        website_audits (*)
      `)
      .eq('id', request.companyId)
      .single();

    if (error || !company) {
      throw new Error(`Failed to fetch company data for proposal: ${error?.message}`);
    }

    const aiInsight = company.company_ai_insights?.[0];
    if (!aiInsight) {
      throw new Error('AI Insights must be generated for this company before creating a proposal.');
    }

    // 2. Map Data to Proposal Content
    const content = this.mapToProposalContent(company.name, request.type, aiInsight);

    // 3. Generate PDF Buffer
    const pdfBuffer = await PdfGenerator.generate(content);

    // 4. Upload to Supabase Storage
    const fileName = `${company.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${request.type.toLowerCase()}-${randomUUID()}.pdf`;
    
    const { error: uploadError } = await this.supabase.storage
      .from('proposals')
      .upload(fileName, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) {
      throw new Error(`Failed to upload PDF to Supabase: ${uploadError.message}`);
    }

    // 5. Get Public URL
    const { data: publicUrlData } = this.supabase.storage
      .from('proposals')
      .getPublicUrl(fileName);

    return {
      url: publicUrlData.publicUrl,
      fileName
    };
  }

  private mapToProposalContent(companyName: string, type: ProposalType, aiInsight: any): ProposalContent {
    // We map the raw AI reasoning into specific problems and solutions based on the type requested.
    // In a real advanced system, we might invoke Ollama again here to rewrite the text perfectly for the PDF.
    // For this engine, we'll extract relevant pieces from the pre-computed AI Insight.
    
    let recommendedSolution = aiInsight.recommended_next_action || 'Implement standard digital strategy.';
    let estimatedBenefits = ['Increased Lead Generation', 'Improved Conversion Rates', 'Higher Brand Authority'];
    let pricingPlaceholder = 'Estimated Investment: $2,500 - $10,000 based on final scope. Let\'s schedule a discovery call.';

    if (type === 'WEBSITE') {
      recommendedSolution = `We recommend a complete website overhaul. ${aiInsight.reasoning}`;
      estimatedBenefits = ['Modern, responsive design', 'Optimized for high conversion', 'Integrated lead capture forms'];
      pricingPlaceholder = 'Website Design & Development Package: Starting at $5,000';
    } else if (type === 'CRM') {
      recommendedSolution = `Implement a centralized CRM system to manage all leads. ${aiInsight.reasoning}`;
      estimatedBenefits = ['No dropped leads', 'Automated follow-ups', 'Clear sales pipeline visibility'];
      pricingPlaceholder = 'CRM Implementation & Training: Starting at $3,500';
    } else if (type === 'WHATSAPP') {
      recommendedSolution = `Deploy a WhatsApp Business API automation flow. ${aiInsight.reasoning}`;
      estimatedBenefits = ['Instant customer support', 'Automated appointment booking', 'High open-rate communication'];
      pricingPlaceholder = 'WhatsApp Automation Setup: Starting at $2,000 + monthly API usage';
    } else if (type === 'SEO') {
      recommendedSolution = `Execute a comprehensive 6-month Search Engine Optimization strategy. ${aiInsight.reasoning}`;
      estimatedBenefits = ['Higher Google Rankings', 'Consistent organic traffic', 'Lower Customer Acquisition Cost'];
      pricingPlaceholder = 'SEO Retainer: Starting at $1,500 / month';
    }

    return {
      companyName,
      type,
      currentProblems: [
        aiInsight.summary,
        ...aiInsight.services_needed.filter((s: string) => typeof s === 'string')
      ],
      recommendedSolution,
      estimatedBenefits,
      pricingPlaceholder
    };
  }
}
