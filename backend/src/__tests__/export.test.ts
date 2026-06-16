import { ExportService } from '../services/ExportService.js';
import { DiscoveryResultRepository } from '../db/repositories/DiscoveryResultRepository.js';

// Mock the repository to return test data
jest.mock('../db/repositories/DiscoveryResultRepository.js');

describe('ExportService', () => {
  let exportService: ExportService;
  let mockRepo: jest.Mocked<DiscoveryResultRepository>;

  beforeEach(() => {
    mockRepo = new DiscoveryResultRepository() as jest.Mocked<DiscoveryResultRepository>;
    exportService = new ExportService();
    // Inject mock
    (exportService as any).resultRepo = mockRepo;
  });

  it('should generate valid CSV output', async () => {
    mockRepo.getResultsWithCompanies.mockResolvedValue([
      {
        id: '1',
        job_id: 'job1',
        source: 'google_maps',
        raw_name: 'Test Company, Inc.',
        raw_phone: '555-1234',
        raw_email: 'test@example.com',
        raw_website: 'test.com',
        raw_address: '123 Main St\nSuite 100',
        is_duplicate: false,
        created_at: new Date().toISOString(),
        companies: {
          id: 'comp1',
          name: 'Test Company, Inc.',
          phone: '555-1234',
          website_url: 'test.com',
          industry: 'Tech',
          status: 'prospect',
          lead_score: 85,
          pipeline_stage: 'new'
        }
      }
    ]);

    const csv = await exportService.exportCSV('job1');
    
    // Check headers
    expect(csv).toContain('Company Name,Phone,Email,Website,Address,Source,Lead Score,Pipeline Stage');
    
    // Check escaping of commas and newlines
    expect(csv).toContain('"Test Company, Inc."');
    expect(csv).toContain('"123 Main St\nSuite 100"');
    expect(csv).toContain('85');
  });

  it('should handle empty results gracefully', async () => {
    mockRepo.getResultsWithCompanies.mockResolvedValue([]);
    const csv = await exportService.exportCSV('job1');
    expect(csv).toBe('Company Name,Phone,Email,Website,Address,Source,Lead Score,Pipeline Stage\n');
  });
});
