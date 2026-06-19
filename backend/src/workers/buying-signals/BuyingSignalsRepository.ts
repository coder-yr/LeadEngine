import { supabase } from '../../config/supabase.js';
import { CompanySignals, SignalInputs } from './types.js';

export class BuyingSignalsRepository {
  async getInputsForSignals(companyId: string): Promise<SignalInputs | null> {
    // Fetch data from companies, intelligence, and audits
    const { data: company } = await supabase
      .from('companies')
      .select('website_url')
      .eq('id', companyId)
      .single();

    const { data: intelligence } = await supabase
      .from('company_intelligence')
      .select('crm_detected, booking_detected, whatsapp_detected, chatbot_detected')
      .eq('company_id', companyId)
      .single();

    const { data: audits } = await supabase
      .from('website_audits')
      .select('seo_score, page_speed_estimate, has_whatsapp_widget')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(1);

    const audit = audits && audits.length > 0 ? audits[0] : null;

    if (!company) {
      return null;
    }

    return {
      has_website: !!company.website_url,
      has_crm: intelligence?.crm_detected || false,
      has_booking_system: intelligence?.booking_detected || false,
      has_chatbot: intelligence?.chatbot_detected || false,
      // If we found it in audit OR intelligence
      has_whatsapp_widget: (audit?.has_whatsapp_widget || intelligence?.whatsapp_detected) || false,
      seo_score: audit?.seo_score || 0,
      page_speed_estimate: audit?.page_speed_estimate || 0
    };
  }

  async upsertSignals(signals: Omit<CompanySignals, 'created_at' | 'updated_at'>): Promise<void> {
    const { error } = await supabase
      .from('company_signals')
      .upsert(signals, { onConflict: 'company_id' });

    if (error) {
      console.error(`Error upserting buying signals for company ${signals.company_id}:`, error);
      throw error;
    }
  }

  async getSignalsByCompanyId(companyId: string): Promise<CompanySignals | null> {
    const { data, error } = await supabase
      .from('company_signals')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (error) {
      console.error(`Error fetching buying signals for company ${companyId}:`, error);
      return null;
    }

    return data;
  }
}
