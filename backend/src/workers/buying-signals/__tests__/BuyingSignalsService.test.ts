import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BuyingSignalsService } from '../BuyingSignalsService.js';
import { SignalInputs } from '../types.js';

export const mockGetInputsForSignals = vi.fn();
export const mockUpsertSignals = vi.fn();

vi.mock('../BuyingSignalsRepository.js', () => {
  return {
    BuyingSignalsRepository: class {
      getInputsForSignals = mockGetInputsForSignals;
      upsertSignals = mockUpsertSignals;
    }
  };
});

describe('BuyingSignalsService', () => {
  let service: BuyingSignalsService;

  beforeEach(() => {
    service = new BuyingSignalsService();
    vi.clearAllMocks();
  });

  describe('calculateSignals', () => {
    it('should calculate 0 intent score for a perfect company', () => {
      const inputs: SignalInputs = {
        has_website: true,
        has_crm: true,
        has_whatsapp_widget: true,
        has_booking_system: true,
        has_chatbot: true,
        seo_score: 90,
        page_speed_estimate: 95
      };

      const signals = service.calculateSignals('comp-1', inputs);
      
      expect(signals.intent_score).toBe(0);
      expect(signals.no_website).toBe(false);
      expect(signals.poor_seo).toBe(false);
      expect(signals.slow_website).toBe(false);
    });

    it('should calculate high intent score for a company missing everything', () => {
      const inputs: SignalInputs = {
        has_website: false,
        has_crm: false,
        has_whatsapp_widget: false,
        has_booking_system: false,
        has_chatbot: false,
        seo_score: 0,
        page_speed_estimate: 0
      };

      const signals = service.calculateSignals('comp-2', inputs);
      
      // no_website: 30, no_crm: 15, no_whatsapp: 15, no_booking_system: 10, no_chatbot: 10
      // Since no website, poor_seo and slow_website are false
      expect(signals.no_website).toBe(true);
      expect(signals.poor_seo).toBe(false);
      expect(signals.slow_website).toBe(false);
      expect(signals.intent_score).toBe(30 + 15 + 15 + 10 + 10); // 80
    });

    it('should calculate max intent score if website exists but is terrible', () => {
      const inputs: SignalInputs = {
        has_website: true,
        has_crm: false,
        has_whatsapp_widget: false,
        has_booking_system: false,
        has_chatbot: false,
        seo_score: 20,
        page_speed_estimate: 40
      };

      const signals = service.calculateSignals('comp-3', inputs);
      
      // poor_seo: 15, slow_website: 15, no_crm: 15, no_whatsapp: 15, no_booking_system: 10, no_chatbot: 10 => 80
      expect(signals.poor_seo).toBe(true);
      expect(signals.slow_website).toBe(true);
      expect(signals.intent_score).toBe(15 + 15 + 15 + 15 + 10 + 10); // 80
    });
  });

  describe('processCompanySignals', () => {
    it('should fetch inputs, calculate signals, and upsert', async () => {
      const inputs: SignalInputs = {
        has_website: true,
        has_crm: true,
        has_whatsapp_widget: false,
        has_booking_system: true,
        has_chatbot: false,
        seo_score: 80,
        page_speed_estimate: 90
      };

      mockGetInputsForSignals.mockResolvedValue(inputs);

      const result = await service.processCompanySignals('comp-123');

      expect(mockGetInputsForSignals).toHaveBeenCalledWith('comp-123');
      expect(mockUpsertSignals).toHaveBeenCalled();
      
      // no_whatsapp = 15
      expect(result?.intent_score).toBe(15);
    });

    it('should return null if no inputs found', async () => {
      mockGetInputsForSignals.mockResolvedValue(null);

      const result = await service.processCompanySignals('comp-unknown');

      expect(result).toBeNull();
      expect(mockUpsertSignals).not.toHaveBeenCalled();
    });
  });
});
