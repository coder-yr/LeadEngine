import { Router } from 'express';
import { supabase } from '../../config/supabase.js';
import { ProposalService } from '../../workers/proposals/ProposalService.js';
import { ProposalRequest } from '../../workers/proposals/ProposalTypes.js';

export const proposalsRouter = Router();

const service = new ProposalService(supabase);

// POST /api/proposals/generate
proposalsRouter.post('/generate', async (req, res) => {
  try {
    const { companyId, type } = req.body as ProposalRequest;

    if (!companyId || !type) {
      return res.status(400).json({ error: 'companyId and type are required' });
    }

    const validTypes = ['WEBSITE', 'CRM', 'WHATSAPP', 'SEO'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${validTypes.join(', ')}` });
    }

    const result = await service.generateProposal({ companyId, type });
    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
