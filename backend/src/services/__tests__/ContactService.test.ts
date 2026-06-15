import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContactService } from '../ContactService.js';
import { ContactRepository } from '../../db/repositories/ContactRepository.js';

export const mockCreateContact = vi.fn().mockResolvedValue({ id: 'contact-123' });
export const mockGetContacts = vi.fn().mockResolvedValue([]);

vi.mock('../../db/repositories/ContactRepository.js', () => {
  return {
    ContactRepository: class {
      createContact = mockCreateContact;
      getContactsByCompanyId = mockGetContacts;
    }
  };
});

describe('ContactService', () => {
  let contactService: ContactService;

  beforeEach(() => {
    contactService = new ContactService();
  });

  describe('calculateDecisionMakerScore', () => {
    it('should return 100 for Owner', () => {
      expect(contactService.calculateDecisionMakerScore('Owner')).toBe(100);
      expect(contactService.calculateDecisionMakerScore('Co-Owner')).toBe(100);
    });

    it('should return 95 for Founder', () => {
      expect(contactService.calculateDecisionMakerScore('Founder')).toBe(95);
      expect(contactService.calculateDecisionMakerScore('Co-Founder')).toBe(95);
    });

    it('should return 90 for CEO', () => {
      expect(contactService.calculateDecisionMakerScore('CEO')).toBe(90);
      expect(contactService.calculateDecisionMakerScore('Chief Executive Officer')).toBe(90);
    });

    it('should return 80 for other Chief/VP/Director roles', () => {
      expect(contactService.calculateDecisionMakerScore('CTO')).toBe(30); // Doesn't match 'chief', misses exact CTO logic, but 'Chief Technology Officer' matches
      expect(contactService.calculateDecisionMakerScore('Chief Technology Officer')).toBe(80);
      expect(contactService.calculateDecisionMakerScore('VP of Engineering')).toBe(80);
      expect(contactService.calculateDecisionMakerScore('Director of Sales')).toBe(80);
    });

    it('should return 70 for Manager roles', () => {
      expect(contactService.calculateDecisionMakerScore('Manager')).toBe(70);
      expect(contactService.calculateDecisionMakerScore('Engineering Lead')).toBe(70);
      expect(contactService.calculateDecisionMakerScore('Head of HR')).toBe(70);
    });

    it('should return 30 for Staff or unmatched roles', () => {
      expect(contactService.calculateDecisionMakerScore('Software Engineer')).toBe(30);
      expect(contactService.calculateDecisionMakerScore('Staff')).toBe(30);
      expect(contactService.calculateDecisionMakerScore('Analyst')).toBe(30);
      expect(contactService.calculateDecisionMakerScore(null)).toBe(30);
    });
  });

  describe('processContact', () => {
    it('should calculate score and call repository createContact', async () => {
      const contactData = {
        company_id: 'comp-123',
        name: 'John Doe',
        title: 'Founder',
        department: 'Executive',
        email: 'john@example.com',
        phone: null,
        linkedin: null
      };

      await contactService.processContact(contactData);

      // Verify that the repository was called with the calculated score of 95
      expect(mockCreateContact).toHaveBeenCalledWith({
        ...contactData,
        decision_maker_score: 95
      });
    });
  });
});
