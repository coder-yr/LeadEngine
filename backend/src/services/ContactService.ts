import { ContactRepository } from '../db/repositories/ContactRepository.js';
import { Contact, ContactInsert } from '../types/contact.js';

export class ContactService {
  private contactRepo: ContactRepository;

  constructor() {
    this.contactRepo = new ContactRepository();
  }

  /**
   * Calculates the decision maker score based on the job title.
   * Owner = 100
   * Founder = 95
   * CEO = 90
   * Manager = 70
   * Staff = 30
   */
  public calculateDecisionMakerScore(title: string | null): number {
    if (!title) return 30; // Default to Staff level if no title is provided

    const normalizedTitle = title.toLowerCase();

    // Exact matches or strong keyword matches
    if (normalizedTitle.includes('owner')) return 100;
    if (normalizedTitle.includes('founder')) return 95;
    if (normalizedTitle.includes('ceo') || normalizedTitle.includes('chief executive')) return 90;
    
    // Additional executive/C-level matching for robust fallback (optional, but good practice)
    if (normalizedTitle.includes('chief') || normalizedTitle.includes('vp') || normalizedTitle.includes('vice president') || normalizedTitle.includes('director')) {
        return 80; // High level, but not CEO/Founder
    }

    if (normalizedTitle.includes('manager') || normalizedTitle.includes('head') || normalizedTitle.includes('lead')) return 70;
    
    // Default fallback
    return 30;
  }

  /**
   * Process and save a new contact
   */
  public async processContact(contactData: Omit<ContactInsert, 'is_decision_maker' | 'is_primary_contact' | 'status'>): Promise<Contact> {
    const score = this.calculateDecisionMakerScore(contactData.title);
    
    const newContact: ContactInsert = {
      ...contactData,
      is_decision_maker: score >= 70,
      is_primary_contact: false,
      status: 'new'
    };

    return await this.contactRepo.createContact(newContact);
  }

  /**
   * Get all contacts for a specific company
   */
  public async getCompanyContacts(companyId: string): Promise<Contact[]> {
    return await this.contactRepo.getContactsByCompanyId(companyId);
  }
}
