import { LeadScoringService } from '../services/LeadScoringService.js';
import { ContactDiscoveryService } from '../services/ContactDiscoveryService.js';
import { ExportService } from '../services/ExportService.js';

describe('Discovery Backend Services', () => {
  describe('LeadScoringService', () => {
    const service = new LeadScoringService();

    it('should score decision makers correctly', () => {
      const contactService = new ContactDiscoveryService();
      expect(contactService.scoreDecisionMaker('CEO')).toBe(100);
      expect(contactService.scoreDecisionMaker('Marketing Manager')).toBe(60);
      expect(contactService.scoreDecisionMaker('Intern')).toBe(20);
      expect(contactService.scoreDecisionMaker(undefined)).toBe(20);
    });

    it('should clamp scores between 0 and 100', () => {
      // We can test private methods by making them public or using any, 
      // but here we just test the logic that we know uses them
      const intentScore = (service as any).calculateIntentScore({
        no_website: true, no_crm: true, no_whatsapp: true,
        poor_seo: true, slow_website: true, no_booking_system: true
      });
      expect(intentScore).toBeLessThanOrEqual(100);
      
      const fitScore = (service as any).calculateFitScore({
        phone: '123', email: 'a@b.com', website_url: 'http', city: 'NY'
      }, [{ is_decision_maker: true }, { email_verified: true }]);
      expect(fitScore).toBeLessThanOrEqual(100);
    });
  });
});
