import { Router, Request, Response } from 'express';
import { SavedListsService } from '../../services/SavedListsService.js';
import { SavedListInsert } from '../../types/saved-lists.js';

const router = Router();
const listsService = new SavedListsService();

// Create List
router.post('/', async (req: Request, res: Response) => {
  try {
    const payload: SavedListInsert = req.body;
    const list = await listsService.createList(payload);
    res.status(201).json({ success: true, data: list });
  } catch (error: any) {
    console.error('Error creating saved list:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fetch all lists
router.get('/', async (req: Request, res: Response) => {
  try {
    const lists = await listsService.getLists();
    res.json({ success: true, data: lists });
  } catch (error: any) {
    console.error('Error fetching saved lists:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fetch List Details
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const listId = req.params.id;
    const details = await listsService.getListDetails(listId);
    res.json({ success: true, data: details });
  } catch (error: any) {
    console.error('Error fetching list details:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete List
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const listId = req.params.id;
    await listsService.deleteList(listId);
    res.json({ success: true, message: 'List deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting list:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add Companies
router.post('/:id/companies', async (req: Request, res: Response) => {
  try {
    const listId = req.params.id;
    const { companyIds } = req.body; // Expecting { companyIds: string[] }
    await listsService.addCompaniesToList(listId, companyIds);
    res.json({ success: true, message: 'Companies added successfully' });
  } catch (error: any) {
    console.error('Error adding companies to list:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add Contacts
router.post('/:id/contacts', async (req: Request, res: Response) => {
  try {
    const listId = req.params.id;
    const { contactIds } = req.body; // Expecting { contactIds: string[] }
    await listsService.addContactsToList(listId, contactIds);
    res.json({ success: true, message: 'Contacts added successfully' });
  } catch (error: any) {
    console.error('Error adding contacts to list:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Remove Companies
router.delete('/:id/companies', async (req: Request, res: Response) => {
  try {
    const listId = req.params.id;
    const { companyIds } = req.body; // Expecting { companyIds: string[] } in JSON body
    await listsService.removeCompaniesFromList(listId, companyIds);
    res.json({ success: true, message: 'Companies removed successfully' });
  } catch (error: any) {
    console.error('Error removing companies from list:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Remove Contacts
router.delete('/:id/contacts', async (req: Request, res: Response) => {
  try {
    const listId = req.params.id;
    const { contactIds } = req.body; // Expecting { contactIds: string[] } in JSON body
    await listsService.removeContactsFromList(listId, contactIds);
    res.json({ success: true, message: 'Contacts removed successfully' });
  } catch (error: any) {
    console.error('Error removing contacts from list:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
