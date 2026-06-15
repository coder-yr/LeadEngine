import { Router, Request, Response } from 'express';
import { CompanyRepository } from '../../db/repositories/CompanyRepository.js';

const router = Router();
const repository = new CompanyRepository();

// GET /api/companies - Get all companies
router.get('/', async (req: Request, res: Response) => {
  try {
    const companies = await repository.getAllCompanies();
    return res.json(companies);
  } catch (error) {
    console.error('Error fetching companies:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/companies/:id - Get single company
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const company = await repository.getCompanyById(id);
    return res.json(company);
  } catch (error) {
    console.error(`Error fetching company ${req.params.id}:`, error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/companies/:id/stage - Update pipeline stage
router.patch('/:id/stage', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { stage } = req.body;

    if (!stage) {
      return res.status(400).json({ error: 'Pipeline stage is required' });
    }

    const updatedCompany = await repository.updatePipelineStage(id, stage);
    return res.json(updatedCompany);
  } catch (error) {
    console.error(`Error updating company ${req.params.id} stage:`, error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
