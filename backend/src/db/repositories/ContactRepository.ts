import { supabase } from '../../config/supabase.js';
import { Contact, ContactInsert } from '../../types/contact.js';

export class ContactRepository {
  async createContact(contact: ContactInsert): Promise<Contact> {
    const { data, error } = await supabase
      .from('contacts')
      .insert([contact])
      .select()
      .single();

    if (error) {
      console.error('Error creating contact:', error);
      throw error;
    }

    return data;
  }

  async getContactsByCompanyId(companyId: string): Promise<Contact[]> {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('company_id', companyId)
      .order('decision_maker_score', { ascending: false });

    if (error) {
      console.error('Error fetching contacts for company:', error);
      throw error;
    }

    return data || [];
  }
}
