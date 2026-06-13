import { supabase } from '../../config/supabase.js';

export interface CompanyInput {
  name: string;
  website_url?: string;
  phone?: string;
  email?: string;
  industry?: string;
  description?: string;
  status?: 'prospect' | 'active' | 'inactive' | 'churned';
}

export class CompanyRepository {
  /**
   * Find a company by either website or phone to ensure uniqueness
   */
  async findByWebsiteOrPhone(website?: string, phone?: string) {
    if (!website && !phone) return null;

    let query = supabase.from('companies').select('*');
    
    if (website && phone) {
      query = query.or(`website_url.eq.${website},phone.eq.${phone}`);
    } else if (website) {
      query = query.eq('website_url', website);
    } else if (phone) {
      query = query.eq('phone', phone);
    }

    const { data, error } = await query.limit(1).maybeSingle();
    
    if (error) {
      console.error('Error finding company:', error);
      throw error;
    }
    
    return data;
  }

  /**
   * Creates a new company if no duplicate exists based on website or phone
   */
  async create(company: CompanyInput) {
    // Check for duplicates
    const existing = await this.findByWebsiteOrPhone(company.website_url, company.phone);
    if (existing) {
      console.log(`Company with website ${company.website_url} or phone ${company.phone} already exists.`);
      return existing; // Return the existing record instead of throwing
    }

    const { data, error } = await supabase
      .from('companies')
      .insert([company])
      .select()
      .single();

    if (error) {
      console.error('Error creating company:', error);
      throw error;
    }

    return data;
  }
}
