import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { OrchestratorService } from '../OrchestratorService.js';
import { intelligenceQueue, failedIntelligenceQueue } from '../Queues.js';

jest.mock('../Queues.js', () => ({
  intelligenceQueue: { add: jest.fn() },
  failedIntelligenceQueue: { add: jest.fn() },
}));

describe('OrchestrationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should start the workflow by adding a job to the intelligence queue', async () => {
    const companyId = 'test-company-123';
    
    const traceId = await OrchestratorService.startCompanyWorkflow(companyId);
    
    expect(traceId).toBeDefined();
    expect(intelligenceQueue.add).toHaveBeenCalledWith(
      'analyze-company', 
      { companyId, traceId }
    );
  });
});
