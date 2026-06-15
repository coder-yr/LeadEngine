import { Router, Request, Response } from 'express';
import { AnalyticsRepository } from '../../db/repositories/AnalyticsRepository.js';

const router = Router();
const repository = new AnalyticsRepository();

router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const data = await repository.getDashboardMetrics();
    return res.json(data);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
