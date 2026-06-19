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

  async updateContact(contactId: string, updates: Partial<Contact>): Promise<Contact> {
    const { data, error } = await supabase
      .from('contacts')
      .update(updates)
      .eq('id', contactId)
      .select()
      .single();

    if (error) {
      console.error(`Error updating contact ${contactId}:`, error);
      throw error;
    }

    return data;
  }

  async findExistingContact(companyId: string, email?: string | null, phone?: string | null, firstName?: string, lastName?: string): Promise<Contact | null> {
    let query = supabase.from('contacts').select('*').eq('company_id', companyId);
    
    if (email) {
      query = query.eq('email', email);
    } else if (phone) {
      query = query.eq('phone', phone);
    } else if (firstName && lastName) {
      // Basic fuzzy matching or exact name match as fallback if no email/phone
      query = query.eq('first_name', firstName).eq('last_name', lastName);
    } else {
      return null;
    }

    const { data, error } = await query.maybeSingle();
    if (error) {
      console.error('Error finding existing contact:', error);
      return null; // degrade gracefully
    }
    return data;
  }

  async bulkCreateContacts(contacts: ContactInsert[]): Promise<Contact[]> {
    if (contacts.length === 0) return [];
    
    const created: Contact[] = [];
    
    for (const c of contacts) {
      const existing = await this.findExistingContact(c.company_id, c.email, c.phone, c.first_name, c.last_name);
      if (!existing) {
        try {
          const newContact = await this.createContact(c);
          created.push(newContact);
        } catch (e) {
          console.error(`Failed to insert contact ${c.first_name} ${c.last_name}:`, e);
        }
      }
    }
    
    return created;
  }

  async getContactsByCompanyId(companyId: string): Promise<Contact[]> {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('company_id', companyId)
      .order('is_decision_maker', { ascending: false });

    if (error) {
      console.error('Error fetching contacts for company:', error);
      throw error;
    }

    return data || [];
  }
}
