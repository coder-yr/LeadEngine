import { Router, Request, Response } from 'express';
import { CampaignRepository } from '../../db/repositories/CampaignRepository.js';
import { outreachQueue } from '../../orchestration/Queues.js';

const router = Router();
const repository = new CampaignRepository();

// GET /api/campaigns - Get all campaigns
router.get('/', async (req: Request, res: Response) => {
  try {
    const campaigns = await repository.getCampaigns();
    return res.json(campaigns);
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/campaigns - Create a new campaign with sequences
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, campaign_type, company_id, steps } = req.body;

    if (!name || !campaign_type || !company_id) {
      return res.status(400).json({ error: 'name, campaign_type, and company_id are required' });
    }

    // 1. Create Campaign
    const newCampaign = await repository.createCampaign({
      name,
      campaign_type,
      company_id
    });

    // 2. Add Steps
    if (steps && steps.length > 0) {
      const formattedSteps = steps.map((s: any) => ({
        ...s,
        campaign_id: newCampaign.id
      }));
      await repository.addCampaignSteps(formattedSteps);
    }

    return res.status(201).json(newCampaign);
  } catch (error) {
    console.error('Error creating campaign:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/campaigns/:id/enroll - Enroll contacts
router.post('/:id/enroll', async (req: Request, res: Response) => {
  try {
    const campaignId = req.params.id;
    const { contacts } = req.body; // Array of { contact_id, company_id }

    if (!contacts || !contacts.length) {
      return res.status(400).json({ error: 'contacts array is required' });
    }

    const enrollments = contacts.map((c: any) => ({
      campaign_id: campaignId,
      contact_id: c.contact_id,
      company_id: c.company_id
    }));

    const result = await repository.enrollContacts(enrollments);
    
    // Trigger the outreach engine to process the new enrollments
    await outreachQueue.add('process-outreach', { timestamp: Date.now() });

    return res.json(result);
  } catch (error) {
    console.error('Error enrolling contacts:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
