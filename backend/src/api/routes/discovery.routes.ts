import { Router } from 'express';
import { DiscoveryController } from '../controllers/discovery.controller.js';
import { getQueueMonitoringData } from '../../orchestration/Monitor.js';

const router = Router();

// Define discovery routes
router.post('/search', DiscoveryController.search);

// Monitoring route for pipeline
router.get('/monitoring', async (req, res) => {
  const data = await getQueueMonitoringData();
  if (data.status === 'error') {
    res.status(500).json(data);
  } else {
    res.status(200).json(data);
  }
});

export default router;
