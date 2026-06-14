import { Router } from 'express';
import { supabase } from '../../config/supabase.js';
import { AiInsightsRepository } from '../../workers/ai-insights/AiInsightsRepository.js';
import { AiInsightsService } from '../../workers/ai-insights/AiInsightsService.js';

export const insightsRouter = Router();

const repository = new AiInsightsRepository(supabase);
const service = new AiInsightsService(supabase, repository);

// GET /api/insights/:companyId
insightsRouter.get('/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    const insight = await repository.getInsightByCompanyId(companyId);
    
    if (!insight) {
      return res.status(404).json({ error: 'AI Insight not found for this company' });
    }

    res.json(insight);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/insights/generate
insightsRouter.post('/generate', async (req, res) => {
  try {
    const { companyId, model } = req.body;

    if (!companyId) {
      return res.status(400).json({ error: 'companyId is required' });
    }

    const result = await service.generateInsight(companyId, model || 'qwen3:8b');
    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
