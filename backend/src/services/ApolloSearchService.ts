import { supabase } from '../config/supabase.js';

export interface ApolloSearchFilters {
  industry?: string;
  city?: string;
  zip?: string;
  size?: string; // e.g., '10-50'
  minLeadScore?: number;
  minIntentScore?: number;
  crmDetected?: boolean;
  whatsappDetected?: boolean;
  limit?: number;
  page?: number;
}

export class ApolloSearchService {
  /**
   * Executes a dynamic Apollo-style search across companies, intelligence, and signals tables.
   */
  async search(filters: ApolloSearchFilters) {
    const limit = filters.limit || 50;
    const page = filters.page || 1;
    const offset = (page - 1) * limit;

    // Determine if we need strict inner joins based on filters provided.
    // If a user filters by lead score, they only want companies WITH intelligence records.
    const requiresIntelligenceInner = 
      filters.minLeadScore !== undefined || 
      filters.crmDetected !== undefined || 
      filters.whatsappDetected !== undefined;
      
    const requiresSignalsInner = 
      filters.minIntentScore !== undefined;

    // Dynamically build the select string
    const intelligenceJoin = requiresIntelligenceInner ? 'company_intelligence!inner(*)' : 'company_intelligence(*)';
    const signalsJoin = requiresSignalsInner ? 'company_signals!inner(*)' : 'company_signals(*)';
    
    const selectQuery = `*, ${intelligenceJoin}, ${signalsJoin}`;

    let query = supabase
      .from('companies')
      .select(selectQuery, { count: 'exact' });

    // 1. Company Table Filters
    if (filters.industry) {
      query = query.eq('industry', filters.industry);
    }
    if (filters.city) {
      query = query.ilike('city', `%${filters.city}%`);
    }
    if (filters.zip) {
      query = query.eq('postal_code', filters.zip);
    }
    if (filters.size) {
      query = query.eq('size', filters.size);
    }

    // 2. Intelligence Table Filters
    if (filters.minLeadScore !== undefined) {
      query = query.gte('company_intelligence.lead_score', filters.minLeadScore);
    }
    if (filters.crmDetected !== undefined) {
      query = query.eq('company_intelligence.crm_detected', filters.crmDetected);
    }
    if (filters.whatsappDetected !== undefined) {
      query = query.eq('company_intelligence.whatsapp_detected', filters.whatsappDetected);
    }

    // 3. Signals Table Filters
    if (filters.minIntentScore !== undefined) {
      query = query.gte('company_signals.intent_score', filters.minIntentScore);
    }

    // Pagination
    query = query.range(offset, offset + limit - 1).order('created_at', { ascending: false });

    const { data, error, count } = await query;

    if (error) {
      console.error('Error executing Apollo search query:', error);
      throw error;
    }

    return {
      results: data,
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: count ? Math.ceil(count / limit) : 0
      }
    };
  }
}
