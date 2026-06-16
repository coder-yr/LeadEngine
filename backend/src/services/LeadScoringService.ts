import { supabase } from '../config/supabase.js';

/**
 * Composite Lead Scoring Engine
 *
 * Lead Score = (Intent Score × 0.35) + (Opportunity Score × 0.35) + (Fit Score × 0.30)
 *
 * Intent Score (0-100): Based on buying signals / missing infrastructure
 * Opportunity Score (0-100): Inverse of digital maturity, weighted by services needed
 * Fit Score (0-100): Company size, decision-maker presence, verified contacts
 */

// Signal weights for Intent Score
const INTENT_WEIGHTS = {
  no_website: 25,
  no_crm: 15,
  no_whatsapp: 15,
  poor_seo: 15,
  slow_website: 10,
  no_booking_system: 10,
  // Additional signals from company data
  has_phone: 5,
  has_address: 5,
};

export class LeadScoringService {
  /**
   * Calculate and store composite lead score for a single company.
   */
  async scoreCompany(companyId: string): Promise<{
    lead_score: number;
    intent_score: number;
    opportunity_score: number;
    fit_score: number;
  }> {
    // Fetch all relevant data
    const { data: company, error } = await supabase
      .from('companies')
      .select(`
        *,
        company_intelligence (
          lead_score, digital_maturity_score, services_needed,
          website_score, crm_detected, whatsapp_detected,
          booking_detected, contact_form_detected
        ),
        company_signals (
          no_website, no_crm, no_whatsapp, poor_seo,
          slow_website, no_booking_system, intent_score
        ),
        contacts (id, is_decision_maker, email_verified, phone_verified)
      `)
      .eq('id', companyId)
      .single();

    if (error || !company) {
      console.warn(`LeadScoring: Company ${companyId} not found`);
      return { lead_score: 0, intent_score: 0, opportunity_score: 0, fit_score: 0 };
    }

    const intelligence = company.company_intelligence?.[0] || company.company_intelligence || null;
    const signals = company.company_signals?.[0] || company.company_signals || null;
    const contacts: any[] = company.contacts || [];

    // 1. Calculate Intent Score (0-100)
    const intentScore = this.calculateIntentScore(signals);

    // 2. Calculate Opportunity Score (0-100)
    const opportunityScore = this.calculateOpportunityScore(intelligence);

    // 3. Calculate Fit Score (0-100)
    const fitScore = this.calculateFitScore(company, contacts);

    // 4. Composite Lead Score
    const leadScore = Math.round(
      (intentScore * 0.35) +
      (opportunityScore * 0.35) +
      (fitScore * 0.30)
    );

    const clampedScore = Math.min(100, Math.max(0, leadScore));

    // Store scores
    await supabase
      .from('companies')
      .update({
        lead_score: clampedScore,
        intent_score: intentScore,
        opportunity_score: opportunityScore,
        fit_score: fitScore,
        last_scored_at: new Date().toISOString(),
      })
      .eq('id', companyId);

    return {
      lead_score: clampedScore,
      intent_score: intentScore,
      opportunity_score: opportunityScore,
      fit_score: fitScore,
    };
  }

  /**
   * Score multiple companies in bulk.
   */
  async bulkScore(companyIds: string[]): Promise<number> {
    let scored = 0;
    for (const id of companyIds) {
      try {
        await this.scoreCompany(id);
        scored++;
      } catch (err) {
        console.error(`LeadScoring: Failed to score company ${id}:`, err);
      }
    }
    return scored;
  }

  /**
   * Get companies ranked by lead score with pagination.
   */
  async getRankedLeads(limit = 50, offset = 0) {
    const { data, error, count } = await supabase
      .from('companies')
      .select(`
        *,
        company_intelligence (lead_score, digital_maturity_score, services_needed),
        company_signals (intent_score),
        contacts (id, first_name, last_name, is_decision_maker)
      `, { count: 'exact' })
      .gt('lead_score', 0)
      .order('lead_score', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('LeadScoring: Error fetching ranked leads:', error);
      throw error;
    }

    return { data: data || [], total: count || 0 };
  }

  /**
   * Intent Score: How much does this company NEED our services?
   * Based on missing infrastructure / buying signals.
   */
  private calculateIntentScore(signals: any): number {
    if (!signals) return 50; // Default mid-range if no signals data

    let score = 0;

    if (signals.no_website) score += INTENT_WEIGHTS.no_website;
    if (signals.no_crm) score += INTENT_WEIGHTS.no_crm;
    if (signals.no_whatsapp) score += INTENT_WEIGHTS.no_whatsapp;
    if (signals.poor_seo) score += INTENT_WEIGHTS.poor_seo;
    if (signals.slow_website) score += INTENT_WEIGHTS.slow_website;
    if (signals.no_booking_system) score += INTENT_WEIGHTS.no_booking_system;

    // Use the pre-calculated intent_score if available and higher
    if (signals.intent_score && signals.intent_score > score) {
      score = signals.intent_score;
    }

    return Math.min(100, score);
  }

  /**
   * Opportunity Score: How likely are we to win this deal?
   * Lower digital maturity = higher opportunity.
   */
  private calculateOpportunityScore(intelligence: any): number {
    if (!intelligence) return 50;

    const maturity = intelligence.digital_maturity_score || 50;
    const servicesNeeded = intelligence.services_needed || [];

    // Base: inverse of maturity
    let score = 100 - maturity;

    // Bonus for each service needed (up to 30 points)
    const serviceBonus = Math.min(30, servicesNeeded.length * 6);
    score = Math.round((score * 0.7) + serviceBonus);

    // If maturity is 0, they might not be a real business
    if (maturity === 0) {
      score = Math.min(score, 50);
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Fit Score: How well does this company match our ideal customer?
   */
  private calculateFitScore(company: any, contacts: any[]): number {
    let score = 0;

    // Has a phone number (contactable)
    if (company.phone) score += 20;

    // Has an email
    if (company.email) score += 15;

    // Has a website (indicates real business)
    if (company.website_url) score += 15;

    // Has contacts
    if (contacts.length > 0) score += 15;

    // Has a decision maker identified
    const hasDecisionMaker = contacts.some((c: any) => c.is_decision_maker);
    if (hasDecisionMaker) score += 20;

    // Has verified contact info
    const hasVerified = contacts.some((c: any) => c.email_verified || c.phone_verified);
    if (hasVerified) score += 10;

    // Has address/location (reachable)
    if (company.city || company.country) score += 5;

    return Math.min(100, score);
  }
}
