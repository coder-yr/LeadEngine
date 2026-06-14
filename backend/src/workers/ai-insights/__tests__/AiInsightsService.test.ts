import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { AiInsightsService } from '../AiInsightsService.js';
import { AiInsightsRepository } from '../AiInsightsRepository.js';

describe('AiInsightsService', () => {
  let service: AiInsightsService;
  let mockSupabase: any;
  let mockRepository: jest.Mocked<AiInsightsRepository>;
  let mockOllama: any;

  beforeEach(() => {
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'test-company-id',
          name: 'Test Corp',
          domain: 'testcorp.com',
          company_intelligence: { website_score: 40 },
          website_audits: []
        },
        error: null
      })
    };

    mockRepository = {
      saveInsight: jest.fn().mockImplementation(async (data) => data),
      getInsightByCompanyId: jest.fn()
    } as any;

    mockOllama = {
      generate: jest.fn().mockResolvedValue({
        response: JSON.stringify({
          summary: "Mock summary of the company.",
          opportunityScore: 85,
          servicesNeeded: ["SEO", "Website Development"],
          reasoning: "Mock reasoning",
          recommendedNextAction: "Mock next action"
        })
      })
    };

    service = new AiInsightsService(mockSupabase, mockRepository, mockOllama);
  });

  it('should fetch company data, call Ollama, and save the result', async () => {
    const result = await service.generateInsight('test-company-id', 'qwen3:8b');

    expect(mockSupabase.from).toHaveBeenCalledWith('companies');
    expect(mockRepository.saveInsight).toHaveBeenCalledWith({
      company_id: 'test-company-id',
      summary: "Mock summary of the company.",
      opportunity_score: 85,
      services_needed: ["SEO", "Website Development"],
      reasoning: "Mock reasoning",
      recommended_next_action: "Mock next action",
      model_used: "qwen3:8b"
    });

    expect(result.opportunity_score).toBe(85);
    expect(result.services_needed).toContain('SEO');
  });

  it('should throw if company is not found', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });

    await expect(service.generateInsight('invalid-id')).rejects.toThrow(/Failed to fetch company data/);
  });
});
