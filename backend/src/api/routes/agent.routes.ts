import { Router, Request, Response } from 'express';
import { AgentService } from '../../services/AgentService.js';

const router = Router();
const service = new AgentService();

// POST /api/agent/chat
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { companyId, message, model } = req.body;

    if (!companyId || !message) {
      return res.status(400).json({ error: 'companyId and message are required' });
    }

    const reply = await service.generateResponse(companyId, message, model);
    return res.status(200).json(reply);
  } catch (error: any) {
    console.error('Error in agent chat:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;
