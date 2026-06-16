import { supabase } from '../config/supabase.js';

interface ContactCandidate {
  name: string;
  email?: string;
  phone?: string;
  title?: string;
  linkedin?: string;
  decision_maker_score: number;
}

const DECISION_MAKER_KEYWORDS: Record<string, number> = {
  'ceo': 100, 'chief executive': 100, 'founder': 100, 'co-founder': 95,
  'owner': 95, 'managing director': 90, 'md': 90, 'president': 90,
  'director': 80, 'vp': 75, 'vice president': 75,
  'head': 70, 'general manager': 70, 'gm': 70,
  'manager': 60, 'senior manager': 65,
  'lead': 50, 'supervisor': 45,
  'coordinator': 30, 'executive': 30, 'associate': 20,
};

export class ContactDiscoveryService {
  /**
   * Discover and store contacts for a company from its discovery results
   * and any crawled website data.
   */
  async discoverContacts(companyId: string): Promise<number> {
    // Get company data including any contacts already extracted
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('*, discovery_results!discovery_results_company_id_fkey(*)')
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      console.warn(`ContactDiscovery: Company ${companyId} not found`);
      return 0;
    }

    const candidates: ContactCandidate[] = [];

    // Extract contacts from discovery results raw_data
    const discoveryResults = company.discovery_results || [];
    for (const result of discoveryResults) {
      const rawData = result.raw_data || {};

      // If IndiaMart/TradeIndia has Contact Person
      if (rawData['Contact Person']) {
        candidates.push({
          name: rawData['Contact Person'],
          phone: result.raw_phone || undefined,
          email: result.raw_email || undefined,
          title: rawData['Designation'] || undefined,
          decision_maker_score: this.scoreDecisionMaker(rawData['Designation']),
        });
      }

      // If there's an email in the raw data
      if (result.raw_email) {
        const name = this.extractNameFromEmail(result.raw_email);
        if (name && !candidates.some(c => c.email === result.raw_email)) {
          candidates.push({
            name,
            email: result.raw_email,
            phone: result.raw_phone || undefined,
            decision_maker_score: 20,
          });
        }
      }
    }

    // If the company itself has contact info but no contacts yet
    if (company.email || company.phone) {
      const existingContact = candidates.find(
        c => c.email === company.email || c.phone === company.phone
      );
      if (!existingContact) {
        candidates.push({
          name: company.name + ' (Primary)',
          email: company.email || undefined,
          phone: company.phone || undefined,
          decision_maker_score: 50,
        });
      }
    }

    // Store contacts (dedup by email/phone)
    let created = 0;
    for (const candidate of candidates) {
      try {
        // Check for existing contact
        let query = supabase.from('contacts').select('id').eq('company_id', companyId);

        if (candidate.email) {
          query = query.eq('email', candidate.email);
        } else if (candidate.phone) {
          query = query.eq('phone', candidate.phone);
        } else {
          continue; // Skip contacts without email or phone
        }

        const { data: existing } = await query.maybeSingle();
        if (existing) continue;

        // Split name into first/last
        const nameParts = candidate.name.split(' ');
        const firstName = nameParts[0] || candidate.name;
        const lastName = nameParts.slice(1).join(' ') || '-';

        const { error } = await supabase.from('contacts').insert([{
          company_id: companyId,
          first_name: firstName,
          last_name: lastName,
          email: candidate.email || null,
          phone: candidate.phone || null,
          title: candidate.title || null,
          linkedin_url: candidate.linkedin || null,
          is_decision_maker: candidate.decision_maker_score >= 70,
          status: 'new',
        }]);

        if (!error) {
          created++;
        } else {
          console.warn(`ContactDiscovery: Failed to insert contact: ${error.message}`);
        }
      } catch (err) {
        console.warn(`ContactDiscovery: Error processing candidate: ${err}`);
      }
    }

    console.log(`ContactDiscovery: Created ${created} contacts for company ${companyId}`);
    return created;
  }

  /**
   * Score a job title for decision-maker likelihood (0-100).
   */
  scoreDecisionMaker(title?: string): number {
    if (!title) return 20;
    const lower = title.toLowerCase().trim();

    for (const [keyword, score] of Object.entries(DECISION_MAKER_KEYWORDS)) {
      if (lower.includes(keyword)) return score;
    }

    return 20;
  }

  /**
   * Try to extract a human name from an email address.
   */
  private extractNameFromEmail(email: string): string | null {
    const local = email.split('@')[0];
    if (!local) return null;

    // Common patterns: first.last, first_last, firstlast
    const cleaned = local
      .replace(/[._-]/g, ' ')
      .replace(/\d+/g, '')
      .trim();

    if (cleaned.length < 2) return null;

    return cleaned
      .split(' ')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
}
