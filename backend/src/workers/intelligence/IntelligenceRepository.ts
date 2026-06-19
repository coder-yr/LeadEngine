import { supabase } from '../../config/supabase.js';
import { RawCompanyData, IntelligenceResult } from './types.js';

export class IntelligenceRepository {
  /**
   * Fetch a company record including its website/audit data to compute intelligence scores.
   * This joins companies and websites table if necessary.
   */
  async getCompanyDataForAnalysis(companyId: string): Promise<RawCompanyData | null> {
    // We assume the company table has basic info, and we might join websites.
    // In this heuristic approach, we pull whatever we can.
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select(`
        id,
        name,
        website_url,
        phone,
        industry,
        website_audits (
          mobile_friendly,
          has_contact_form,
          has_whatsapp_widget,
          seo_score,
          social_links_found
        )
      `)
      .eq('id', companyId)
      .maybeSingle();

    if (companyError || !company) {
      console.error(`Error fetching company ${companyId}:`, companyError);
      return null;
    }

    // Determine raw feature set from website_audits relation if it exists
    const websiteData = company.website_audits && company.website_audits.length > 0 ? company.website_audits[0] : null;

    return {
      id: company.id,
      name: company.name,
      website_url: company.website_url,
      phone: company.phone,
      industry: company.industry,
      has_website: !!company.website_url,
      has_contact_form: websiteData?.has_contact_form || false,
      has_whatsapp_widget: websiteData?.has_whatsapp_widget || false,
      has_booking_system: false, // Wait, website_audits doesn't have has_booking_system explicitly, but AuditService might add it if we expand it. For now false.
      has_crm: false,
      website_score: websiteData?.seo_score || 0,
      social_profiles: websiteData?.social_links_found || []
    };
  }

  /**
   * Upsert the calculated IntelligenceResult into the company_intelligence table
   */
  async upsertIntelligence(companyId: string, result: IntelligenceResult): Promise<void> {
    const { error } = await supabase
      .from('company_intelligence')
      .upsert(
        {
          company_id: companyId,
          website_exists: result.websiteExists,
          website_score: result.websiteScore,
          crm_detected: result.crmDetected,
          booking_detected: result.bookingDetected,
          whatsapp_detected: result.whatsappDetected,
          contact_form_detected: result.contactFormDetected,
          social_profiles: result.socialProfiles,
          digital_maturity_score: result.digitalMaturityScore,
          services_needed: result.servicesNeeded,
          lead_score: result.leadScore,
          analyzed_at: new Date().toISOString()
        },
        { onConflict: 'company_id' }
      );

    if (error) {
      console.error(`Error upserting intelligence for company ${companyId}:`, error);
      throw error;
    }
  }
}
