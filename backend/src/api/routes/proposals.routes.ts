import { Router, Request, Response } from 'express';
import { ProposalService } from '../../services/ProposalService.js';

const router = Router();
const service = new ProposalService();

// POST /api/proposals/:companyId/generate
router.post('/:companyId/generate', async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const proposal = await service.generateProposal(companyId);
    return res.status(201).json(proposal);
  } catch (error) {
    console.error('Error generating proposal:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/proposals/:companyId
router.get('/:companyId', async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const proposals = await service.getProposals(companyId);
    return res.json(proposals);
  } catch (error) {
    console.error('Error fetching proposals:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
