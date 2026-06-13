import { supabase } from '../../config/supabase.js';
import { CompanyRepository } from './CompanyRepository.js';

export interface LeadInput {
  companyName: string;
  website?: string;
  phone?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  industry?: string;
  description?: string;
}

export class LeadRepository {
  private companyRepo: CompanyRepository;

  constructor() {
    this.companyRepo = new CompanyRepository();
  }

  /**
   * Save a discovered lead. Ensures no duplicates by phone or website.
   * Creates records in companies, contacts, and websites tables.
   */
  async saveLead(lead: LeadInput) {
    // 1. Handle Company Creation (ensures no duplicates by website or phone)
    let company = await this.companyRepo.findByWebsiteOrPhone(lead.website, lead.phone);
    
    if (!company) {
      company = await this.companyRepo.create({
        name: lead.companyName,
        website_url: lead.website,
        phone: lead.phone,
        email: lead.email,
        industry: lead.industry,
        description: lead.description,
        status: 'prospect'
      });
    } else {
      console.log(`Lead associated with existing company: ${company.name}`);
    }

    // 2. If contact details are provided, save to contacts table
    if (lead.firstName && lead.lastName) {
      // Check if contact already exists for this company
      let contactQuery = supabase
        .from('contacts')
        .select('*')
        .eq('company_id', company.id);
        
      if (lead.email) {
        contactQuery = contactQuery.eq('email', lead.email);
      } else if (lead.phone) {
        contactQuery = contactQuery.eq('phone', lead.phone);
      }

      const { data: existingContact } = await contactQuery.limit(1).maybeSingle();

      if (!existingContact) {
        const { error: contactError } = await supabase
          .from('contacts')
          .insert([{
            company_id: company.id,
            first_name: lead.firstName,
            last_name: lead.lastName,
            email: lead.email,
            phone: lead.phone,
            status: 'new'
          }]);
          
        if (contactError) {
          console.error('Error creating contact:', contactError);
        }
      }
    }
    
    // 3. Save website to websites table if it exists
    if (lead.website) {
      const { data: existingWebsite } = await supabase
        .from('websites')
        .select('id')
        .eq('url', lead.website)
        .limit(1)
        .maybeSingle();
        
      if (!existingWebsite) {
         try {
           const domain = new URL(lead.website.startsWith('http') ? lead.website : `https://${lead.website}`).hostname;
           await supabase.from('websites').insert([{
             company_id: company.id,
             url: lead.website,
             domain_name: domain,
             status: 'pending_audit'
           }]);
         } catch (e) {
           console.error('Error saving website:', e);
         }
      }
    }

    return company;
  }
}
