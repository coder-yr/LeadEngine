import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { ProposalService } from '../ProposalService.js';
import { PdfGenerator } from '../PdfGenerator.js';

// Mock PdfGenerator
jest.unstable_mockModule('../PdfGenerator.js', () => ({
  PdfGenerator: {
    generate: jest.fn().mockResolvedValue(Buffer.from('mock-pdf-content'))
  }
}));

describe('ProposalService', () => {
  let service: ProposalService;
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = {
      from: jest.fn().mockImplementation((table) => {
        if (table === 'companies') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'test-company-id',
                name: 'Test Corp',
                company_ai_insights: [{
                  summary: 'Bad website',
                  services_needed: ['WEBSITE'],
                  reasoning: 'It is slow',
                  recommended_next_action: 'Pitch website'
                }]
              },
              error: null
            })
          };
        }
        return this;
      }),
      storage: {
        from: jest.fn().mockImplementation((bucket) => {
          return {
            upload: jest.fn().mockResolvedValue({ error: null }),
            getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'https://mock-url/file.pdf' } })
          };
        })
      }
    };

    service = new ProposalService(mockSupabase);
  });

  it('should generate a PDF and upload it to Supabase', async () => {
    const result = await service.generateProposal({ companyId: 'test-company-id', type: 'WEBSITE' });

    expect(mockSupabase.from).toHaveBeenCalledWith('companies');
    expect(mockSupabase.storage.from).toHaveBeenCalledWith('proposals');
    expect(result.url).toBe('https://mock-url/file.pdf');
    expect(result.fileName).toContain('test_corp-website-');
  });

  it('should throw if AI Insights are missing', async () => {
    mockSupabase.from = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'test-company-id',
          name: 'Test Corp',
          company_ai_insights: [] // Missing
        },
        error: null
      })
    });

    await expect(service.generateProposal({ companyId: 'test-company-id', type: 'WEBSITE' }))
      .rejects.toThrow(/AI Insights must be generated/);
  });
});
