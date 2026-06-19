import { Router, Request, Response } from 'express';
import { ContactService } from '../../services/ContactService.js';

const router = Router();
const contactService = new ContactService();

// POST /api/contacts - Create a new contact
router.post('/', async (req: Request, res: Response) => {
  try {
    const contactData = req.body;
    
    // Basic validation
    if (!contactData.company_id || !contactData.name) {
      return res.status(400).json({ error: 'company_id and name are required' });
    }

    const newContact = await contactService.processContact({
      company_id: contactData.company_id,
      first_name: contactData.first_name || contactData.name?.split(' ')[0] || 'Unknown',
      last_name: contactData.last_name || contactData.name?.split(' ').slice(1).join(' ') || '-',
      title: contactData.title || null,
      department: contactData.department || null,
      linkedin_url: contactData.linkedin_url || contactData.linkedin || null,
      email: contactData.email || null,
      phone: contactData.phone || null
    });

    return res.status(201).json(newContact);
  } catch (error) {
    console.error('Error creating contact:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/contacts/company/:companyId - Get contacts for a company
router.get('/company/:companyId', async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const contacts = await contactService.getCompanyContacts(companyId);
    return res.json(contacts);
  } catch (error) {
    console.error('Error fetching contacts:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
