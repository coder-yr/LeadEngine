import { SupabaseClient } from '@supabase/supabase-js';
import { normalizePhone, extractDomain, similarityRatio } from './DeduplicationService.js';

export interface LeadIdentityRecord {
  id: string;
  normalized_name: string;
  normalized_domain: string | null;
  normalized_phone: string | null;
  address_hash: string | null;
  gstin: string | null;
  cin: string | null;
  stage: string;
  source_count: number;
  source_names: string[];
  identity_confidence: number;
  created_at: string;
  updated_at: string;
}

export type DiscoveryStage =
  | 'DISCOVERED'
  | 'IDENTITY_RESOLVED'
  | 'WEBSITE_SELECTED'
  | 'WEBSITE_CRAWLED'
  | 'CONFIDENCE_EVALUATED'
  | 'ADAPTIVE_ENRICHMENT'
  | 'CONTACTS_EXTRACTED'
  | 'AI_INTELLIGENCE'
  | 'LEAD_SCORED'
  | 'COMPLETE'
  | 'READY';

/**
 * IdentityResolutionService
 *
 * Bridges the Python-side LeadIdentity resolver with the Node.js/Supabase data layer.
 * Responsibilities:
 *   - Persist resolved identities from Python output to lead_identities table
 *   - Link companies to lead_identity_id
 *   - Advance pipeline stages
 *   - Log stage transitions
 *   - Resume a lead from its current stage
 */
export class IdentityResolutionService {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Upsert a lead identity from Python discovery output.
   * Matches on phone → domain → GSTIN → CIN → fuzzy name.
   * Returns the existing or newly created identity ID.
   */
  async upsertIdentity(params: {
    normalizedName: string;
    normalizedDomain?: string | null;
    normalizedPhone?: string | null;
    gstin?: string | null;
    cin?: string | null;
    addressHash?: string | null;
    sourceNames: string[];
    identityConfidence: number;
  }): Promise<string> {
    // 1. Try to find existing identity by exact signals
    const existing = await this.findExisting(params);
    if (existing) {
      // Merge — update source list and confidence
      await this.supabase
        .from('lead_identities')
        .update({
          source_count: existing.source_count + 1,
          source_names: [...new Set([...existing.source_names, ...params.sourceNames])],
          identity_confidence: Math.max(existing.identity_confidence, params.identityConfidence),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
      return existing.id;
    }

    // 2. Create new identity
    const { data, error } = await this.supabase
      .from('lead_identities')
      .insert({
        normalized_name: params.normalizedName,
        normalized_domain: params.normalizedDomain || null,
        normalized_phone: params.normalizedPhone || null,
        address_hash: params.addressHash || null,
        gstin: params.gstin || null,
        cin: params.cin || null,
        stage: 'DISCOVERED' as DiscoveryStage,
        source_count: 1,
        source_names: params.sourceNames,
        identity_confidence: params.identityConfidence,
      })
      .select('id')
      .single();

    if (error || !data) {
      throw new Error(`Failed to create lead identity: ${error?.message}`);
    }

    return data.id;
  }

  /**
   * Link a company record to a lead identity.
   */
  async linkCompany(companyId: string, leadIdentityId: string): Promise<void> {
    const { error } = await this.supabase
      .from('companies')
      .update({ lead_identity_id: leadIdentityId })
      .eq('id', companyId);

    if (error) {
      throw new Error(`Failed to link company ${companyId} to identity: ${error.message}`);
    }
  }

  /**
   * Advance a lead identity to the next stage and log the transition.
   */
  async advanceStage(
    leadIdentityId: string,
    toStage: DiscoveryStage,
    options: {
      fromStage?: DiscoveryStage;
      durationMs?: number;
      companyId?: string;
      success?: boolean;
      errorMessage?: string;
      metadata?: Record<string, unknown>;
    } = {}
  ): Promise<void> {
    // Update current stage
    await this.supabase
      .from('lead_identities')
      .update({
        stage: toStage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', leadIdentityId);

    // Log the transition
    await this.supabase.from('discovery_stages_log').insert({
      lead_identity_id: leadIdentityId,
      company_id: options.companyId || null,
      from_stage: options.fromStage || null,
      to_stage: toStage,
      duration_ms: options.durationMs || null,
      success: options.success ?? true,
      error_message: options.errorMessage || null,
      metadata: options.metadata || {},
    });
  }

  /**
   * Get the current stage for a lead identity.
   */
  async getCurrentStage(leadIdentityId: string): Promise<DiscoveryStage | null> {
    const { data, error } = await this.supabase
      .from('lead_identities')
      .select('stage')
      .eq('id', leadIdentityId)
      .single();

    if (error || !data) return null;
    return data.stage as DiscoveryStage;
  }

  /**
   * Find an existing identity using exact-match signals.
   * Priority: phone → domain → GSTIN → CIN.
   */
  private async findExisting(params: {
    normalizedPhone?: string | null;
    normalizedDomain?: string | null;
    gstin?: string | null;
    cin?: string | null;
    normalizedName: string;
  }): Promise<LeadIdentityRecord | null> {
    // Try phone exact match
    if (params.normalizedPhone) {
      const { data } = await this.supabase
        .from('lead_identities')
        .select('*')
        .eq('normalized_phone', params.normalizedPhone)
        .limit(1)
        .single();
      if (data) return data as LeadIdentityRecord;
    }

    // Try domain exact match
    if (params.normalizedDomain) {
      const { data } = await this.supabase
        .from('lead_identities')
        .select('*')
        .eq('normalized_domain', params.normalizedDomain)
        .limit(1)
        .single();
      if (data) return data as LeadIdentityRecord;
    }

    // Try GSTIN match
    if (params.gstin) {
      const { data } = await this.supabase
        .from('lead_identities')
        .select('*')
        .eq('gstin', params.gstin)
        .limit(1)
        .single();
      if (data) return data as LeadIdentityRecord;
    }

    // Try CIN match
    if (params.cin) {
      const { data } = await this.supabase
        .from('lead_identities')
        .select('*')
        .eq('cin', params.cin)
        .limit(1)
        .single();
      if (data) return data as LeadIdentityRecord;
    }

    // Fuzzy name match via trigram index
    const { data: nameMatches } = await this.supabase
      .from('lead_identities')
      .select('*')
      .ilike('normalized_name', `%${params.normalizedName.slice(0, 10)}%`)
      .limit(10);

    if (nameMatches?.length) {
      for (const candidate of nameMatches) {
        const sim = similarityRatio(candidate.normalized_name, params.normalizedName);
        if (sim >= 0.85) {
          return candidate as LeadIdentityRecord;
        }
      }
    }

    return null;
  }

  /**
   * Get pipeline status counts (for health dashboard).
   */
  async getPipelineCounts(): Promise<Record<DiscoveryStage, number>> {
    const { data, error } = await this.supabase
      .from('lead_identities')
      .select('stage')
      .not('stage', 'is', null);

    if (error || !data) return {} as Record<DiscoveryStage, number>;

    const counts: Partial<Record<DiscoveryStage, number>> = {};
    for (const row of data) {
      const stage = row.stage as DiscoveryStage;
      counts[stage] = (counts[stage] || 0) + 1;
    }
    return counts as Record<DiscoveryStage, number>;
  }
}
