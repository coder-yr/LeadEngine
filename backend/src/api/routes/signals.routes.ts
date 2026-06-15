import { Router, Request, Response } from 'express';
import { BuyingSignalsRepository } from '../../workers/buying-signals/BuyingSignalsRepository.js';

const router = Router();
const repository = new BuyingSignalsRepository();

// GET /api/signals/company/:companyId - Get buying signals for a company
router.get('/company/:companyId', async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const signals = await repository.getSignalsByCompanyId(companyId);
    
    if (!signals) {
      return res.status(404).json({ error: 'Buying signals not found for this company' });
    }

    return res.json(signals);
  } catch (error) {
    console.error('Error fetching buying signals:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
