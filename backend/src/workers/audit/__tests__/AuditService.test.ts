import { AuditService } from '../AuditService.js';
import { jest } from '@jest/globals';

describe('AuditService', () => {
  let auditService: AuditService;

  beforeEach(() => {
    auditService = new AuditService();
    // Mock the fetch call globally
    global.fetch = jest.fn() as any;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should accurately parse HTML and return audit results', async () => {
    const mockHtml = `
      <html>
        <head>
          <title>Test Company</title>
          <meta name="description" content="We are a great company" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        </head>
        <body>
          <h1>Welcome to Test Company</h1>
          <form id="contact-us">
            <input type="text" />
          </form>
          <a href="https://wa.me/123456789">Chat with us on WhatsApp</a>
          <a href="https://linkedin.com/company/test">LinkedIn</a>
        </body>
      </html>
    `;

    (global.fetch as any).mockResolvedValue({
      ok: true,
      text: async () => mockHtml
    } as any);

    const result = await auditService.auditWebsite('https://example.com');

    expect(result.sslEnabled).toBe(true);
    expect(result.seoScore).toBe(80); // Title (+30), MetaDesc (+30), H1 (+20). Canonical is missing.
    expect(result.mobileFriendly).toBe(true);
    expect(result.hasContactForm).toBe(true);
    expect(result.hasWhatsAppWidget).toBe(true);
    expect(result.socialLinksFound).toContain('https://linkedin.com/company/test');
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'seo', message: 'Missing canonical link' })
      ])
    );
  });

  it('should flag issues when key elements are missing', async () => {
    const mockHtml = `
      <html>
        <head></head>
        <body>
          <div>No headings or forms</div>
        </body>
      </html>
    `;

    (global.fetch as any).mockResolvedValue({
      ok: true,
      text: async () => mockHtml
    } as any);

    const result = await auditService.auditWebsite('https://example.com');

    expect(result.seoScore).toBe(0);
    expect(result.hasContactForm).toBe(false);
    expect(result.hasWhatsAppWidget).toBe(false);
    expect(result.mobileFriendly).toBe(false);
    
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'seo', message: 'Missing <title> tag', severity: 'high' }),
        expect.objectContaining({ type: 'conversion', message: 'No contact forms detected' })
      ])
    );
  });
});
