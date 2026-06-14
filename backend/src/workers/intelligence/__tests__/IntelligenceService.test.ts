import { IntelligenceService } from '../IntelligenceService.js';
import { RawCompanyData, ServiceRecommendation } from '../types.js';

describe('IntelligenceService', () => {
  let service: IntelligenceService;

  beforeEach(() => {
    service = new IntelligenceService({} as any); // Mock repository not needed for pure logic tests
  });

  describe('calculateDigitalMaturity', () => {
    it('should calculate 0 for a company with no presence', () => {
      const data: RawCompanyData = { id: '1', name: 'Ghost Co' };
      const score = service.calculateDigitalMaturity(data);
      expect(score).toBe(0);
    });

    it('should score high for a company with full digital presence', () => {
      const data: RawCompanyData = {
        id: '2',
        name: 'Tech Giant',
        has_website: true,
        website_score: 95,
        has_crm: true,
        has_booking_system: true,
        has_whatsapp_widget: true,
        has_contact_form: true,
        social_profiles: ['https://linkedin.com/in/techgiant']
      };
      const score = service.calculateDigitalMaturity(data);
      // 30 (website) + 19 (website quality 95/100*20) + 15 + 15 + 10 + 5 + 5 = 99
      expect(score).toBe(99);
    });

    it('should bound score at 100', () => {
      const data: RawCompanyData = {
        id: '3',
        name: 'Perfect Co',
        has_website: true,
        website_score: 100, // +20
        has_crm: true,      // +10
        has_booking_system: true, // +15
        has_whatsapp_widget: true, // +15
        has_contact_form: true, // +5
        social_profiles: ['x'] // +5
        // total before bounds = 30+20+10+15+15+5+5 = 100
      };
      const score = service.calculateDigitalMaturity(data);
      expect(score).toBe(100);
    });
  });

  describe('determineServicesNeeded', () => {
    it('should recommend everything if company has no digital presence', () => {
      const data: RawCompanyData = { id: '1', name: 'Ghost Co' };
      const services = service.determineServicesNeeded(data);
      
      expect(services).toContain(ServiceRecommendation.WEBSITE_DEVELOPMENT);
      expect(services).toContain(ServiceRecommendation.CRM_DEVELOPMENT);
      expect(services).toContain(ServiceRecommendation.WHATSAPP_AUTOMATION);
      expect(services).toContain(ServiceRecommendation.BOOKING_SYSTEM);
      expect(services).toContain(ServiceRecommendation.AI_CHATBOT);
    });

    it('should only recommend missing parts', () => {
      const data: RawCompanyData = {
        id: '2',
        name: 'Halfway There',
        has_website: true,
        website_score: 80, // No SEO recommended because >= 70
        has_crm: true,
        has_whatsapp_widget: false,
        has_booking_system: true,
        has_contact_form: true,
      };

      const services = service.determineServicesNeeded(data);
      expect(services).not.toContain(ServiceRecommendation.WEBSITE_DEVELOPMENT);
      expect(services).not.toContain(ServiceRecommendation.CRM_DEVELOPMENT);
      expect(services).toContain(ServiceRecommendation.WHATSAPP_AUTOMATION);
      // Because whatsapp is false, AI chatbot is recommended
      expect(services).toContain(ServiceRecommendation.AI_CHATBOT);
      expect(services).not.toContain(ServiceRecommendation.SEO);
    });
  });

  describe('calculateLeadScore', () => {
    it('should return 50 if maturity is 0 (to avoid spam prospects)', () => {
      expect(service.calculateLeadScore(0)).toBe(50);
    });

    it('should inversely correlate with maturity', () => {
      expect(service.calculateLeadScore(20)).toBe(80);
      expect(service.calculateLeadScore(80)).toBe(20);
      expect(service.calculateLeadScore(100)).toBe(0);
    });
  });
});
