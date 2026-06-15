export interface CompanySignals {
  company_id: string;
  no_website: boolean;
  no_crm: boolean;
  no_whatsapp: boolean;
  poor_seo: boolean;
  slow_website: boolean;
  no_booking_system: boolean;
  intent_score: number;
  created_at?: Date;
  updated_at?: Date;
}

export interface SignalInputs {
  has_website: boolean;
  has_crm: boolean;
  has_whatsapp_widget: boolean;
  has_booking_system: boolean;
  seo_score: number;
  page_speed_estimate: number;
}
