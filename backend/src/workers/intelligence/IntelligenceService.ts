import { IntelligenceRepository } from './IntelligenceRepository.js';
import { RawCompanyData, IntelligenceResult, ServiceRecommendation } from './types.js';

export class IntelligenceService {
  private repository: IntelligenceRepository;

  constructor(repository?: IntelligenceRepository) {
    this.repository = repository || new IntelligenceRepository();
  }

  /**
   * Main entry point to analyze a company and save the results
   */
  async analyzeCompany(companyId: string): Promise<IntelligenceResult | null> {
    const rawData = await this.repository.getCompanyDataForAnalysis(companyId);
    if (!rawData) {
      console.warn(`No raw data found for company ${companyId}`);
      return null;
    }

    const digitalMaturityScore = this.calculateDigitalMaturity(rawData);
    const servicesNeeded = this.determineServicesNeeded(rawData);
    const leadScore = this.calculateLeadScore(digitalMaturityScore);

    const result: IntelligenceResult = {
      websiteExists: rawData.has_website || false,
      websiteScore: rawData.website_score || 0,
      crmDetected: rawData.has_crm || false,
      bookingDetected: rawData.has_booking_system || false,
      whatsappDetected: rawData.has_whatsapp_widget || false,
      contactFormDetected: rawData.has_contact_form || false,
      socialProfiles: rawData.social_profiles || [],
      digitalMaturityScore,
      servicesNeeded,
      leadScore
    };

    await this.repository.upsertIntelligence(companyId, result);
    return result;
  }

  /**
   * Calculate a 0-100 maturity score based on present features.
   */
  calculateDigitalMaturity(data: RawCompanyData): number {
    let score = 0;

    // Weights (Total = 100)
    if (data.has_website) score += 30;
    
    // Website score acts as a multiplier/additive for quality (0-20 points)
    if (data.has_website && data.website_score) {
      score += Math.round((data.website_score / 100) * 20);
    }

    if (data.has_whatsapp_widget) score += 15;
    if (data.has_booking_system) score += 15;
    if (data.has_crm) score += 10;
    if (data.has_contact_form) score += 5;
    if (data.social_profiles && data.social_profiles.length > 0) score += 5;

    return Math.min(Math.max(score, 0), 100);
  }

  /**
   * Identify which services this company might need based on missing features.
   */
  determineServicesNeeded(data: RawCompanyData): string[] {
    const services: string[] = [];

    if (!data.has_website || (data.website_score !== undefined && data.website_score < 50)) {
      services.push(ServiceRecommendation.WEBSITE_DEVELOPMENT);
    }

    if (!data.has_crm) {
      services.push(ServiceRecommendation.CRM_DEVELOPMENT);
    }

    if (!data.has_whatsapp_widget) {
      services.push(ServiceRecommendation.WHATSAPP_AUTOMATION);
    }

    if (!data.has_booking_system) {
      services.push(ServiceRecommendation.BOOKING_SYSTEM);
    }

    if (data.website_score !== undefined && data.website_score < 70) {
      services.push(ServiceRecommendation.SEO);
    }

    // AI Chatbot can be recommended to anyone missing a contact form or whatsapp widget
    if (!data.has_contact_form || !data.has_whatsapp_widget) {
      services.push(ServiceRecommendation.AI_CHATBOT);
    }

    return Array.from(new Set(services)); // deduplicate just in case
  }

  /**
   * Lead Score indicates how likely they are to buy services from us.
   * Lower digital maturity = Higher lead score (they need more help).
   * But a minimum presence (e.g., they exist and have a website) might be required to afford it.
   */
  calculateLeadScore(maturityScore: number): number {
    // Basic inversion: 100 - maturity
    let leadScore = 100 - maturityScore;

    // If maturity is 0 (no website, no nothing), they might be a ghost or too small to afford services.
    // We adjust score slightly down if they have absolute zero presence to avoid pure spam leads.
    if (maturityScore === 0) {
      leadScore = 50; 
    }

    return Math.min(Math.max(leadScore, 0), 100);
  }
}
