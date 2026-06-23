import { supabase } from '../../config/supabase.js';
import { AuditResult } from './types.js';

export class AuditRepository {
  async saveAuditResult(companyId: string, result: AuditResult): Promise<void> {
    // Map TS object properties to snake_case for Supabase
    const dbData = {
      company_id: companyId,
      url: result.url,
      seo_score: result.seoScore,
      mobile_friendly: result.mobileFriendly,
      ssl_enabled: result.sslEnabled,
      page_speed_estimate: result.pageSpeedEstimate,
      has_contact_form: result.hasContactForm,
      has_whatsapp_widget: result.hasWhatsAppWidget,
      social_links_found: result.socialLinksFound,
      audit_summary: result.auditSummary,
      issues: result.issues,
      fetch_time_ms: result.fetchTimeMs || 0,
      parse_time_ms: result.parseTimeMs || 0,
      ai_time_ms: result.aiTimeMs || 0,
      total_time_ms: result.totalTimeMs || 0
    };

    const { error } = await supabase
      .from('website_audits')
      .insert(dbData);

    if (error) {
      throw new Error(`Failed to save audit result for company ${companyId}: ${error.message}`);
    }
  }

  async getCompanyWebsite(companyId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('companies')
      .select('website_url')
      .eq('id', companyId)
      .single();
      
    if (error || !data) {
      return null;
    }
    
    return data.website_url;
  }
}
