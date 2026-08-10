import { supabase } from '../config/supabase.js';

export interface ParsedQuery {
  keyword: string;
  location: string | null;
}

export class DatabaseDiscoveryService {
  /**
   * Deterministically parses a search query to extract intent and location.
   */
  parseQuery(query: string): ParsedQuery {
    const trimmed = query.trim();
    
    // Pattern: "[keyword] in [location]"
    const inMatch = trimmed.match(/^(.+?)\s+in\s+(.+)$/i);
    if (inMatch) {
      return {
        keyword: inMatch[1].trim(),
        location: inMatch[2].trim()
      };
    }
    
    // Pattern: "[keyword] near [location]"
    const nearMatch = trimmed.match(/^(.+?)\s+near\s+(.+)$/i);
    if (nearMatch) {
      return {
        keyword: nearMatch[1].trim(),
        location: nearMatch[2].trim()
      };
    }

    return {
      keyword: trimmed,
      location: null
    };
  }

  /**
   * Searches the global companies table for existing matches.
   */
  async searchLocalDatabase(query: string, maxResults: number = 50) {
    const { keyword, location } = this.parseQuery(query);
    
    let dbQuery = supabase
      .from('companies')
      .select(`
        id, 
        name, 
        industry, 
        description, 
        city, 
        state_province, 
        website_url, 
        phone, 
        email
      `)
      .limit(maxResults);
      
    if (location) {
      dbQuery = dbQuery.or(`city.ilike.%${location}%,state_province.ilike.%${location}%`);
    }

    // Keyword search using ilike across multiple fields
    if (keyword) {
      const kw = `%${keyword}%`;
      dbQuery = dbQuery.or(`name.ilike.${kw},industry.ilike.${kw},description.ilike.${kw}`);
    }

    const { data, error } = await dbQuery;

    if (error) {
      console.error('Error in DatabaseDiscoveryService:', error);
      throw error;
    }

    return data || [];
  }
}

export const databaseDiscoveryService = new DatabaseDiscoveryService();
