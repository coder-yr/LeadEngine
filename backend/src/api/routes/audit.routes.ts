import { Router, Request, Response } from 'express';
import { AuditService } from '../../workers/audit/AuditService.js';
import { ContactDiscoveryService } from '../../services/ContactDiscoveryService.js';
import { StatelessIntelligenceService } from '../../services/StatelessIntelligenceService.js';

const router = Router();
const auditService = new AuditService();
const discoveryService = new ContactDiscoveryService();
const intelligenceService = new StatelessIntelligenceService();

// POST /api/audit/test
// Runs an on-the-fly audit (Quick or Deep) without saving to the DB.
router.post('/test', async (req: Request, res: Response) => {
  try {
    const { url, type } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const quickAudit = type !== 'deep'; // Defaults to Quick Audit (true) if not explicitly 'deep'

    // Run Audit and Discovery concurrently
    const [auditResult, discoveryResult] = await Promise.all([
      auditService.auditWebsite(url, { quickAudit }),
      discoveryService.testDiscovery(url, { quickAudit })
    ]);
    
    const intelligence = intelligenceService.calculateIntelligence(auditResult, discoveryResult.contacts);
    
    return res.json({
      success: true,
      data: {
        audit: auditResult,
        contacts: discoveryResult.contacts,
        intelligence,
        metrics: {
          auditTimeMs: auditResult.totalTimeMs,
          discoveryTimeMs: discoveryResult.metrics.websiteScrapeTime || 0,
          pythonTimeouts: discoveryResult.metrics.timeoutCount || 0,
          fetchTimeMs: auditResult.fetchTimeMs,
          parseTimeMs: auditResult.parseTimeMs,
          aiTimeMs: auditResult.aiTimeMs,
        },
        debug: {
          ollama: auditResult.debug?.ollama,
          contactDiscovery: discoveryResult.debug?.contactDiscovery
        }
      }
    });
  } catch (error: any) {
    console.error('Test Audit Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Internal server error during audit' 
    });
  }
});

export default router;
