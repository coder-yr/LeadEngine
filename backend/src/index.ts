import 'dotenv/config';
console.log('Bootstrapping backend...');
import express, { Express, Request, Response, NextFunction } from 'express';

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION:', reason);
  process.exit(1);
});

import cors from 'cors';
import { requireAuth } from './api/middleware/auth.middleware.js';
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
import analysisRoutes from './api/routes/analysis.routes.js';

// Initialize background workers
import { bullBoardAdapter } from './orchestration/BullBoard.js';
import('./orchestration/QueueWorkers.js').catch(err => {
  console.error("FATAL ERROR IMPORTING WORKERS:", err);
});

const app: Express = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// ─── CORS ──────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:4173',
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

app.use(express.json());

// ─── HEALTH CHECK (public) ──────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', version: '0.1.0', timestamp: new Date().toISOString() });
});

// ─── BULL BOARD (password-protected admin) ──────────────────────────────────
const BULL_BOARD_PASSWORD = process.env.BULL_BOARD_PASSWORD;

function bullBoardAuth(req: Request, res: Response, next: NextFunction) {
  if (!BULL_BOARD_PASSWORD) {
    // No password set — only allow in non-production
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Bull Board requires BULL_BOARD_PASSWORD in production.' });
    }
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Bull Board"');
    return res.status(401).send('Authentication required');
  }

  const [scheme, credentials] = authHeader.split(' ');
  if (scheme !== 'Basic' || !credentials) {
    return res.status(401).send('Invalid authorization format');
  }

  const decoded = Buffer.from(credentials, 'base64').toString('utf-8');
  const [, password] = decoded.split(':');

  if (password !== BULL_BOARD_PASSWORD) {
    return res.status(401).send('Invalid credentials');
  }

  next();
}

app.use('/admin/queues', bullBoardAuth, bullBoardAdapter.getRouter());

// ─── ROOT (public) ──────────────────────────────────────────────────────────
app.get('/', (_req: Request, res: Response) => {
  res.json({ message: 'LeadEngine API', version: '0.1.0' });
});

// ─── TRACKING (public — called by email clients & external webhooks) ─────────
app.use('/api/tracking', trackingRoutes);

// ─── PROTECTED API ROUTES ────────────────────────────────────────────────────
// All routes below this middleware require a valid Supabase JWT
app.use('/api', requireAuth);

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
app.use('/api/audit', auditRoutes);
app.use('/api/analysis', analysisRoutes);

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});

export default app;
