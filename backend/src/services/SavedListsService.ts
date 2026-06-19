import { SavedListsRepository } from '../db/repositories/SavedListsRepository.js';
import { SavedList, SavedListInsert, SavedListDetails } from '../types/saved-lists.js';

export class SavedListsService {
  private repository: SavedListsRepository;

  constructor() {
    this.repository = new SavedListsRepository();
  }

  async createList(data: SavedListInsert): Promise<SavedList> {
    if (!data.name || data.name.trim() === '') {
      throw new Error('List name is required');
    }
    return this.repository.createList(data);
  }

  async getLists(): Promise<SavedList[]> {
    return this.repository.getLists();
  }

  async getListDetails(listId: string): Promise<SavedListDetails> {
    return this.repository.getListById(listId);
  }

  async addCompaniesToList(listId: string, companyIds: string[]): Promise<void> {
    if (!companyIds || companyIds.length === 0) return;
    await this.repository.addCompaniesToList(listId, companyIds);
  }

  async addContactsToList(listId: string, contactIds: string[]): Promise<void> {
    if (!contactIds || contactIds.length === 0) return;
    await this.repository.addContactsToList(listId, contactIds);
  }

  async removeCompaniesFromList(listId: string, companyIds: string[]): Promise<void> {
    if (!companyIds || companyIds.length === 0) return;
    await this.repository.removeCompaniesFromList(listId, companyIds);
  }

  async removeContactsFromList(listId: string, contactIds: string[]): Promise<void> {
    if (!contactIds || contactIds.length === 0) return;
    await this.repository.removeContactsFromList(listId, contactIds);
  }

  async deleteList(listId: string): Promise<void> {
    await this.repository.deleteList(listId);
  }
}
