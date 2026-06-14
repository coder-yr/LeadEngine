export interface RawCompanyData {
  id: string;
  name: string;
  website_url?: string | null;
  phone?: string | null;
  industry?: string | null;
  // Raw attributes that might have been scraped/determined externally
  has_website?: boolean;
  has_crm?: boolean;
  has_booking_system?: boolean;
  has_whatsapp_widget?: boolean;
  has_contact_form?: boolean;
  social_profiles?: string[];
  website_score?: number;
}

export enum ServiceRecommendation {
  WEBSITE_DEVELOPMENT = 'Website Development',
  CRM_DEVELOPMENT = 'CRM Development',
  WHATSAPP_AUTOMATION = 'WhatsApp Automation',
  AI_CHATBOT = 'AI Chatbot',
  MOBILE_APP = 'Mobile App',
  SEO = 'SEO',
  BOOKING_SYSTEM = 'Booking System Setup',
}

export interface IntelligenceResult {
  websiteExists: boolean;
  websiteScore: number;
  crmDetected: boolean;
  bookingDetected: boolean;
  whatsappDetected: boolean;
  contactFormDetected: boolean;
  socialProfiles: string[];
  digitalMaturityScore: number;
  servicesNeeded: string[];
  leadScore: number;
}
