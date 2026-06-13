import { Router } from 'express';
import { DiscoveryController } from '../controllers/discovery.controller.js';

const router = Router();

// Define discovery routes
router.post('/search', DiscoveryController.search);

export default router;
