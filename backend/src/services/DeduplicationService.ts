import { distance as levenshteinDistance } from 'fastest-levenshtein';

export interface RawDiscoveryRecord {
  id: string;
  raw_name?: string;
  raw_phone?: string;
  raw_website?: string;
  raw_address?: string;
  source: string;
  [key: string]: any;
}

export interface DedupResult {
  uniqueRecords: RawDiscoveryRecord[];
  duplicatePairs: { resultId: string; duplicateOfId: string }[];
  totalRaw: number;
  totalAfterDedup: number;
}

const SIMILARITY_THRESHOLD = 0.85;

/**
 * Normalize a phone number for comparison.
 * Strips all non-digit characters and returns the last 10 digits.
 */
export function normalizePhone(phone: string | undefined | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return null;
  // Take last 10 digits (strips country code)
  return digits.slice(-10);
}

/**
 * Extract the domain from a URL for comparison.
 */
export function extractDomain(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    let normalized = url.trim().toLowerCase();
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      normalized = 'https://' + normalized;
    }
    const urlObj = new URL(normalized);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Calculate similarity ratio between two strings (0 to 1).
 * Uses Levenshtein distance normalized by the max string length.
 */
export function similarityRatio(a: string, b: string): number {
  if (!a || !b) return 0;
  const cleanA = a.trim().toLowerCase();
  const cleanB = b.trim().toLowerCase();
  if (cleanA === cleanB) return 1;
  const maxLen = Math.max(cleanA.length, cleanB.length);
  if (maxLen === 0) return 1;
  const dist = levenshteinDistance(cleanA, cleanB);
  return 1 - dist / maxLen;
}

export class DeduplicationService {
  /**
   * Deduplicate a list of raw discovery records.
   *
   * Algorithm:
   * 1. Group by normalized phone number (exact match)
   * 2. Group remaining by website domain (exact match)
   * 3. Fuzzy-match remaining by business name (85% threshold)
   * 4. For each duplicate group, keep the most complete record
   */
  deduplicate(records: RawDiscoveryRecord[]): DedupResult {
    if (records.length === 0) {
      return { uniqueRecords: [], duplicatePairs: [], totalRaw: 0, totalAfterDedup: 0 };
    }

    const totalRaw = records.length;
    const duplicatePairs: { resultId: string; duplicateOfId: string }[] = [];

    // Track which records are already matched
    const matched = new Set<string>();
    // Map: canonical record ID -> group of record IDs
    const groups: Map<string, string[]> = new Map();

    // Pre-compute normalized values
    const phoneMap = new Map<string, string[]>();   // normalizedPhone -> recordIds
    const domainMap = new Map<string, string[]>();   // domain -> recordIds
    const phoneForRecord = new Map<string, string | null>();
    const domainForRecord = new Map<string, string | null>();

    for (const record of records) {
      const phone = normalizePhone(record.raw_phone);
      const domain = extractDomain(record.raw_website);
      phoneForRecord.set(record.id, phone);
      domainForRecord.set(record.id, domain);

      if (phone) {
        if (!phoneMap.has(phone)) phoneMap.set(phone, []);
        phoneMap.get(phone)!.push(record.id);
      }
      if (domain) {
        if (!domainMap.has(domain)) domainMap.set(domain, []);
        domainMap.get(domain)!.push(record.id);
      }
    }

    // Step 1: Group by phone
    for (const [, ids] of phoneMap) {
      if (ids.length > 1) {
        const canonical = this.pickCanonical(ids, records);
        const groupIds = ids.filter(id => id !== canonical);
        groups.set(canonical, [...(groups.get(canonical) || []), ...groupIds]);
        for (const id of ids) {
          matched.add(id);
        }
      }
    }

    // Step 2: Group remaining by domain
    for (const [, ids] of domainMap) {
      const unmatched = ids.filter(id => !matched.has(id));
      if (unmatched.length > 1) {
        const canonical = this.pickCanonical(unmatched, records);
        const groupIds = unmatched.filter(id => id !== canonical);
        groups.set(canonical, [...(groups.get(canonical) || []), ...groupIds]);
        for (const id of unmatched) {
          matched.add(id);
        }
      }
    }

    // Step 3: Fuzzy name match on remaining unmatched
    const remainingRecords = records.filter(r => !matched.has(r.id));
    const nameMatched = new Set<string>();

    for (let i = 0; i < remainingRecords.length; i++) {
      if (nameMatched.has(remainingRecords[i].id)) continue;

      const group: string[] = [remainingRecords[i].id];

      for (let j = i + 1; j < remainingRecords.length; j++) {
        if (nameMatched.has(remainingRecords[j].id)) continue;

        const nameA = remainingRecords[i].raw_name || '';
        const nameB = remainingRecords[j].raw_name || '';
        if (nameA && nameB && similarityRatio(nameA, nameB) >= SIMILARITY_THRESHOLD) {
          group.push(remainingRecords[j].id);
          nameMatched.add(remainingRecords[j].id);
        }
      }

      if (group.length > 1) {
        const canonical = this.pickCanonical(group, records);
        const duplicates = group.filter(id => id !== canonical);
        groups.set(canonical, [...(groups.get(canonical) || []), ...duplicates]);
        nameMatched.add(remainingRecords[i].id);
      }
    }

    // Build duplicate pairs
    for (const [canonicalId, dupeIds] of groups) {
      for (const dupeId of dupeIds) {
        duplicatePairs.push({ resultId: dupeId, duplicateOfId: canonicalId });
      }
    }

    // Build unique records list
    const duplicateIds = new Set(duplicatePairs.map(p => p.resultId));
    const uniqueRecords = records.filter(r => !duplicateIds.has(r.id));

    return {
      uniqueRecords,
      duplicatePairs,
      totalRaw,
      totalAfterDedup: uniqueRecords.length,
    };
  }

  /**
   * Pick the "best" (most complete) record from a group to be the canonical.
   * Priority:
   * 1. Highest quality_score
   * 2. Website exists
   * 3. Email exists
   * 4. Phone exists
   */
  private pickCanonical(ids: string[], allRecords: RawDiscoveryRecord[]): string {
    const recordMap = new Map(allRecords.map(r => [r.id, r]));

    let bestId = ids[0];
    let bestScore = -1;

    for (const id of ids) {
      const record = recordMap.get(id);
      if (!record) continue;

      let score = record.raw_data?.quality_score || 0;
      
      // If quality_score is the same (or 0), we add fractional points for other properties
      // to resolve ties according to priority: Website > Email > Phone.
      let tieBreaker = 0;
      if (record.raw_website) tieBreaker += 0.4;
      if (record.raw_email) tieBreaker += 0.3;
      if (record.raw_phone) tieBreaker += 0.2;
      
      const totalScore = score + tieBreaker;

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestId = id;
      }
    }

    return bestId;
  }

  /**
   * Find the best matching existing company for a discovery record.
   * Returns the company and match confidence score (0 to 1.0).
   * Only returns a match if the confidence >= SIMILARITY_THRESHOLD.
   */
  findBestMatch(record: RawDiscoveryRecord, existingCompanies: any[]): { company: any; confidence: number; reason: string } | null {
    if (!existingCompanies || existingCompanies.length === 0) return null;

    const recordPhone = normalizePhone(record.raw_phone);
    const recordDomain = extractDomain(record.raw_website);
    const recordName = record.raw_name || '';

    let bestMatch = null;
    let highestConfidence = 0;
    let bestReason = '';

    for (const company of existingCompanies) {
      let confidence = 0;
      let reason = '';

      // 1. Exact Phone Match
      const companyPhone = normalizePhone(company.phone);
      if (recordPhone && companyPhone && recordPhone === companyPhone) {
        confidence = 1.0;
        reason = 'Exact Phone Match';
      }
      
      // 2. Exact Domain Match
      const companyDomain = extractDomain(company.website_url);
      if (confidence < 1.0 && recordDomain && companyDomain && recordDomain === companyDomain) {
        confidence = Math.max(confidence, 0.9);
        if (confidence === 0.9) reason = 'Exact Domain Match';
      }

      // 3. Fuzzy Name Match
      const companyName = company.name || '';
      if (confidence < 0.9 && recordName && companyName) {
        const nameSim = similarityRatio(recordName, companyName);
        confidence = Math.max(confidence, nameSim);
        if (confidence === nameSim) reason = 'Fuzzy Name Match';
      }

      if (confidence > highestConfidence) {
        highestConfidence = confidence;
        bestMatch = company;
        bestReason = reason;
      }

      // If we find a perfect match, no need to keep looking
      if (highestConfidence === 1.0) {
        break;
      }
    }

    if (bestMatch && highestConfidence >= SIMILARITY_THRESHOLD) {
      return { company: bestMatch, confidence: highestConfidence, reason: bestReason };
    }

    return null;
  }
}
