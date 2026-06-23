import 'dotenv/config';
import express, { Express, Request, Response } from 'express';

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION:', reason);
  process.exit(1);
});

import cors from 'cors';
import discoveryRoutes from './api/routes/discovery.routes.js';
import analyticsRoutes from './api/routes/analytics.routes.js';
import campaignsRoutes from './api/routes/campaigns.routes.js';
import companiesRoutes from './api/routes/companies.routes.js';
import contactRoutes from './api/routes/contact.routes.js';
import listsRoutes from './api/routes/lists.routes.js';
import proposalsRoutes from './api/routes/proposals.routes.js';
import signalsRoutes from './api/routes/signals.routes.js';
import tasksRoutes from './api/routes/tasks.routes.js';
import agentRoutes from './api/routes/agent.routes.js';
import searchRoutes from './api/routes/search.routes.js';
import trackingRoutes from './api/routes/tracking.routes.js';
import auditRoutes from './api/routes/audit.routes.js';

// Initialize background workers
import { bullBoardAdapter } from './orchestration/BullBoard.js';
import('./orchestration/QueueWorkers.js').catch(err => {
  console.error("FATAL ERROR IMPORTING WORKERS:", err);
});

const app: Express = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Bull Board Queue Dashboard
app.use('/admin/queues', bullBoardAdapter.getRouter());

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

// API Routes
app.use('/api/discovery', discoveryRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/campaigns', campaignsRoutes);
app.use('/api/companies', companiesRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/lists', listsRoutes);
app.use('/api/proposals', proposalsRoutes);
app.use('/api/signals', signalsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/audit', auditRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
