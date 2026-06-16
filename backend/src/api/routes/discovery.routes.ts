import { Router } from 'express';
import { DiscoveryJobsController } from '../controllers/discovery-jobs.controller.js';
import { BulkAnalyzeController } from '../controllers/bulk-analyze.controller.js';

const router = Router();

// Job Management & Searching
router.post('/search', DiscoveryJobsController.startDiscovery);
router.get('/jobs', DiscoveryJobsController.getJobs);
router.get('/jobs/:id', DiscoveryJobsController.getJobById);
router.delete('/jobs/:id', DiscoveryJobsController.deleteJob);
router.get('/jobs/:id/results', DiscoveryJobsController.getJobResults);

// Statistics
router.get('/stats', DiscoveryJobsController.getStats);

// Bulk Actions
router.post('/bulk-analyze', BulkAnalyzeController.bulkAnalyze);

// Exports
router.get('/export/:id', DiscoveryJobsController.exportCSV);
router.get('/export/:id/xlsx', DiscoveryJobsController.exportXLSX);

export default router;
