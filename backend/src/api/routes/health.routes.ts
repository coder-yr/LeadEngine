import { Router, Request, Response } from 'express';
import { supabase } from '../../config/supabase.js';
import { HealthService } from '../../services/HealthService.js';

const router = Router();
const healthService = new HealthService(supabase);

/**
 * GET /api/health/dashboard
 * Returns a full health snapshot as JSON.
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const dashboard = await healthService.getDashboard();
    const statusCode = dashboard.overall_status === 'critical' ? 503 : 200;
    res.status(statusCode).json(dashboard);
  } catch (err: any) {
    res.status(500).json({ error: 'Health check failed', details: err.message });
  }
});

/**
 * GET /api/health/stream
 * Server-Sent Events (SSE) — pushes health updates every 10 seconds.
 * Connect with: new EventSource('/api/health/stream')
 */
router.get('/stream', async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');  // Disable Nginx buffering
  res.flushHeaders();

  const sendUpdate = async () => {
    try {
      const dashboard = await healthService.getDashboard();
      res.write(`data: ${JSON.stringify(dashboard)}\n\n`);
    } catch (err: any) {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    }
  };

  // Send initial data immediately
  await sendUpdate();

  // Poll every 10 seconds
  const interval = setInterval(sendUpdate, 10_000);

  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
});

/**
 * GET /api/health/sources
 * Returns just source reliability data (lightweight endpoint).
 */
router.get('/sources', async (req: Request, res: Response) => {
  try {
    const dashboard = await healthService.getDashboard();
    res.json({ sources: dashboard.sources, timestamp: dashboard.timestamp });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/health/pipeline
 * Returns pipeline stage counts (useful for progress indicators).
 */
router.get('/pipeline', async (req: Request, res: Response) => {
  try {
    const dashboard = await healthService.getDashboard();
    res.json({ pipeline: dashboard.pipeline, timestamp: dashboard.timestamp });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
