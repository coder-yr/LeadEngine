import 'dotenv/config';
import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import discoveryRoutes from './api/routes/discovery.routes.js';

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

import { insightsRouter } from './api/routes/insights.js';
import { proposalsRouter } from './api/routes/proposals.js';

// API Routes
app.use('/api/discovery', discoveryRoutes);
app.use('/api/insights', insightsRouter);
app.use('/api/proposals', proposalsRouter);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
