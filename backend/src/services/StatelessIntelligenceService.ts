import { AuditResult } from '../workers/audit/types.js';

export interface StatelessIntelligence {
  lead_score: number;
  intent_score: number;
  opportunity_score: number;
  digital_maturity_score: number;
  recommended_services: Array<{
    service: string;
    confidence: number;
    reason: string;
  }>;
}

export class StatelessIntelligenceService {
  public calculateIntelligence(audit: AuditResult, contacts: any[]): StatelessIntelligence {
    let intentScore = 50;
    let maturityScore = 50;
    
    const recommended_services: Array<{ service: string, confidence: number, reason: string }> = [];

    // Calculate Maturity and Recommend Services
    if (!audit.hasWhatsAppWidget) {
      maturityScore -= 10;
      recommended_services.push({ service: 'WhatsApp Automation', confidence: 95, reason: 'No WhatsApp integration found on the website.' });
    }
    
    if (!audit.hasCrm) {
      maturityScore -= 15;
      recommended_services.push({ service: 'CRM Development', confidence: 85, reason: 'No standard CRM (HubSpot, Salesforce, etc.) detected.' });
    }

    if (!audit.hasBookingSystem) {
      maturityScore -= 10;
      recommended_services.push({ service: 'Booking System', confidence: 80, reason: 'No automated booking or scheduling system found.' });
    }

    if (!audit.hasChatbot) {
      maturityScore -= 10;
      recommended_services.push({ service: 'AI Chatbot', confidence: 90, reason: 'No chatbot detected for instant customer support.' });
    }

    if (audit.seoScore < 50) {
      maturityScore -= 15;
      recommended_services.push({ service: 'SEO Optimization', confidence: 95, reason: `Low SEO score (${audit.seoScore}/100). Missing critical meta tags.` });
    }

    if (!audit.mobileFriendly) {
      maturityScore -= 20;
      recommended_services.push({ service: 'Website Development', confidence: 95, reason: 'Website lacks basic mobile responsiveness tags.' });
    }

    if (audit.pageSpeedEstimate < 80) {
      maturityScore -= 10;
      if (!recommended_services.some(s => s.service === 'Website Development')) {
         recommended_services.push({ service: 'Website Development', confidence: 80, reason: 'Performance metrics indicate slow load times or a bloated DOM.' });
      }
    }

    maturityScore = Math.max(0, Math.min(100, maturityScore));

    // Calculate Intent (based on missing features representing a need)
    intentScore = 100 - maturityScore; 

    // Opportunity Score
    let opportunityScore = 100 - maturityScore;
    const serviceBonus = Math.min(30, recommended_services.length * 6);
    opportunityScore = Math.round((opportunityScore * 0.7) + serviceBonus);
    opportunityScore = Math.max(0, Math.min(100, opportunityScore));

    // Calculate Fit Score
    let fitScore = 0;
    if (contacts.length > 0) fitScore += 30;
    if (contacts.some(c => c.decision_maker)) fitScore += 30;
    if (contacts.some(c => c.email)) fitScore += 20;
    if (contacts.some(c => c.phone)) fitScore += 20;

    // Composite Lead Score
    let lead_score = Math.round((intentScore * 0.35) + (opportunityScore * 0.35) + (fitScore * 0.30));
    lead_score = Math.max(0, Math.min(100, lead_score));

    return {
      lead_score,
      intent_score: intentScore,
      opportunity_score: opportunityScore,
      digital_maturity_score: maturityScore,
      recommended_services
    };
  }
}
