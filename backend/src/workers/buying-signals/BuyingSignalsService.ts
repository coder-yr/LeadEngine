import { BuyingSignalsRepository } from './BuyingSignalsRepository.js';
import { CompanySignals, SignalInputs } from './types.js';

export class BuyingSignalsService {
  private repository: BuyingSignalsRepository;

  constructor(repository?: BuyingSignalsRepository) {
    this.repository = repository || new BuyingSignalsRepository();
  }

  /**
   * Process and calculate intent score and flags for a company
   */
  async processCompanySignals(companyId: string): Promise<CompanySignals | null> {
    const inputs = await this.repository.getInputsForSignals(companyId);
    
    if (!inputs) {
      console.warn(`No data found for company ${companyId} when processing buying signals.`);
      return null;
    }

    const signals = this.calculateSignals(companyId, inputs);
    await this.repository.upsertSignals(signals);
    
    return signals;
  }

  /**
   * Calculates the specific boolean signals and overall intent score
   */
  calculateSignals(companyId: string, inputs: SignalInputs): Omit<CompanySignals, 'created_at' | 'updated_at'> {
    let intentScore = 0;

    const no_website = !inputs.has_website;
    const no_crm = !inputs.has_crm;
    const no_whatsapp = !inputs.has_whatsapp_widget;
    const no_booking_system = !inputs.has_booking_system;
    
    // Website quality signals (only valid if they actually have a website)
    const poor_seo = inputs.has_website && inputs.seo_score < 50;
    const slow_website = inputs.has_website && inputs.page_speed_estimate < 80;

    // Intent Score weights (Total 100 max points)
    // The higher the score, the more they NEED our services.
    if (no_website) intentScore += 30; // Critical need
    if (poor_seo) intentScore += 15;
    if (slow_website) intentScore += 15;
    if (no_crm) intentScore += 15;
    if (no_whatsapp) intentScore += 15;
    if (no_booking_system) intentScore += 10;

    // Cap at 100
    intentScore = Math.min(100, intentScore);

    return {
      company_id: companyId,
      no_website,
      no_crm,
      no_whatsapp,
      poor_seo,
      slow_website,
      no_booking_system,
      intent_score: intentScore
    };
  }
}
