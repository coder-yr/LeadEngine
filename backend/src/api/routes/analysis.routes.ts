import { Router } from 'express';
import { AnalysisService } from '../../services/AnalysisService.js';
import { AnalysisProgressService } from '../../services/AnalysisProgressService.js';

const router = Router();
const analysisService = new AnalysisService();

// POST /api/analysis/:companyId
// Starts analysis for a single company
router.post('/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    const result = await analysisService.startAnalysis(companyId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/analysis/bulk
// Starts bulk analysis
router.post('/bulk', async (req, res) => {
  try {
    const { companyIds } = req.body;
    if (!Array.isArray(companyIds)) {
      return res.status(400).json({ error: 'companyIds must be an array' });
    }
    const result = await analysisService.startBulkAnalysis(companyIds);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/analysis/:companyId
// Returns current analysis state
router.get('/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    const state = await analysisService.getAnalysisState(companyId);
    res.json(state);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/analysis/:companyId/stream
// SSE endpoint for live job progress
router.get('/:companyId/stream', (req, res) => {
  const { companyId } = req.params;
  AnalysisProgressService.addClient(companyId, res);
});

export default router;
