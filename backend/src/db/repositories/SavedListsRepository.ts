import { supabase } from '../../config/supabase.js';
import { SavedList, SavedListInsert, SavedListDetails } from '../../types/saved-lists.js';

export class SavedListsRepository {
  async createList(list: SavedListInsert): Promise<SavedList> {
    const { data, error } = await supabase
      .from('saved_lists')
      .insert(list)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getLists(): Promise<SavedList[]> {
    const { data, error } = await supabase
      .from('saved_lists')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getListById(listId: string): Promise<SavedListDetails> {
    // Fetch list details
    const { data: listData, error: listError } = await supabase
      .from('saved_lists')
      .select('*')
      .eq('id', listId)
      .single();

    if (listError) throw listError;

    // Fetch associated companies with details
    const { data: companiesData, error: companiesError } = await supabase
      .from('saved_list_companies')
      .select('added_at, companies(*)')
      .eq('list_id', listId);
      
    if (companiesError) throw companiesError;

    // Fetch associated contacts with details
    const { data: contactsData, error: contactsError } = await supabase
      .from('saved_list_contacts')
      .select('added_at, contacts(*)')
      .eq('list_id', listId);

    if (contactsError) throw contactsError;

    return {
      ...listData,
      companies: companiesData.map(c => ({ ...c.companies, added_at: c.added_at })),
      contacts: contactsData.map(c => ({ ...c.contacts, added_at: c.added_at }))
    };
  }

  async addCompaniesToList(listId: string, companyIds: string[]): Promise<void> {
    const payloads = companyIds.map(companyId => ({
      list_id: listId,
      company_id: companyId
    }));

    const { error } = await supabase
      .from('saved_list_companies')
      .upsert(payloads, { onConflict: 'list_id, company_id' });

    if (error) throw error;
  }

  async addContactsToList(listId: string, contactIds: string[]): Promise<void> {
    const payloads = contactIds.map(contactId => ({
      list_id: listId,
      contact_id: contactId
    }));

    const { error } = await supabase
      .from('saved_list_contacts')
      .upsert(payloads, { onConflict: 'list_id, contact_id' });

    if (error) throw error;
  }

  async removeCompaniesFromList(listId: string, companyIds: string[]): Promise<void> {
    const { error } = await supabase
      .from('saved_list_companies')
      .delete()
      .eq('list_id', listId)
      .in('company_id', companyIds);

    if (error) throw error;
  }

  async removeContactsFromList(listId: string, contactIds: string[]): Promise<void> {
    const { error } = await supabase
      .from('saved_list_contacts')
      .delete()
      .eq('list_id', listId)
      .in('contact_id', contactIds);

    if (error) throw error;
  }

  async deleteList(listId: string): Promise<void> {
    const { error } = await supabase
      .from('saved_lists')
      .delete()
      .eq('id', listId);

    if (error) throw error;
  }
}
