import { DiscoveryService } from '../services/discovery.service.js';
import { DeduplicationService } from '../services/DeduplicationService.js';

describe('Discovery Integration', () => {
  describe('Deduplication Engine', () => {
    const dedupService = new DeduplicationService();

    it('should identify duplicates by exact phone number ignoring format', () => {
      const records = [
        { id: '1', source: 'google_maps', raw_name: 'Test Co', raw_phone: '+1 (555) 123-4567' },
        { id: '2', source: 'justdial', raw_name: 'Test Company', raw_phone: '5551234567' },
        { id: '3', source: 'indiamart', raw_name: 'Other Co', raw_phone: '9999999999' }
      ];

      const result = dedupService.deduplicate(records);
      expect(result.totalRaw).toBe(3);
      expect(result.totalAfterDedup).toBe(2);
      expect(result.duplicatePairs.length).toBe(1);
    });

    it('should identify duplicates by fuzzy name matching', () => {
      const records = [
        { id: '1', source: 'google_maps', raw_name: 'Dr. Smith Dental Clinic' },
        { id: '2', source: 'justdial', raw_name: 'Dr Smith Dental Clinic' },
        { id: '3', source: 'indiamart', raw_name: 'Completely Different Name' }
      ];

      const result = dedupService.deduplicate(records);
      expect(result.totalAfterDedup).toBe(2);
      expect(result.duplicatePairs.length).toBe(1);
    });

    it('should pick the most complete record as canonical', () => {
      const records = [
        { 
          id: '1', source: 'google_maps', raw_name: 'Test Co', 
          raw_phone: '5551234567' 
        },
        { 
          id: '2', source: 'justdial', raw_name: 'Test Co', 
          raw_phone: '5551234567', raw_website: 'test.com', raw_email: 'hello@test.com' 
        }
      ];

      const result = dedupService.deduplicate(records);
      expect(result.totalAfterDedup).toBe(1);
      // Record 2 should be kept because it has more fields
      expect(result.uniqueRecords[0].id).toBe('2');
      expect(result.duplicatePairs[0].duplicateOfId).toBe('2');
      expect(result.duplicatePairs[0].resultId).toBe('1');
    });
  });
});
