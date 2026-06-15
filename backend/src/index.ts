import 'dotenv/config';
import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import discoveryRoutes from './api/routes/discovery.routes.js';
import './orchestration/index.js'; // Initialize queues and scalable workers
import { bullBoardAdapter } from './orchestration/BullBoard.js';

/**
 * LeadEngine Backend API
 *
 * This is the main entry point for the backend application.
 *
 * TODO (Phase 1):
 * - Setup environment variables
 * - Connect to Supabase
 * - Setup Redis connection
 * - Implement database migrations
 * - Create authentication middleware
 * - Setup error handling
 * - Create API routes
 */

const app: Express = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  });
});

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'LeadEngine API',
    version: '0.1.0',
    docs: '/api/docs',
  });
});

import contactRoutes from './api/routes/contact.routes.js';
import signalsRoutes from './api/routes/signals.routes.js';
import companiesRoutes from './api/routes/companies.routes.js';
import tasksRoutes from './api/routes/tasks.routes.js';
import campaignsRoutes from './api/routes/campaigns.routes.js';
import analyticsRoutes from './api/routes/analytics.routes.js';
import proposalsRoutes from './api/routes/proposals.routes.js';
import agentRoutes from './api/routes/agent.routes.js';

// API Routes
app.use('/api/discovery', discoveryRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/signals', signalsRoutes);
app.use('/api/companies', companiesRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/campaigns', campaignsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/proposals', proposalsRoutes);
app.use('/api/agent', agentRoutes);

// Admin Dashboard for BullMQ
app.use('/admin/queues', bullBoardAdapter.getRouter());

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
