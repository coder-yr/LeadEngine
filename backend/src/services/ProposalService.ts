import PDFDocument from 'pdfkit';
import { supabase } from '../config/supabase.js';
import { createTraceLogger } from '../utils/logger.js';

export class ProposalService {
  async generateProposal(companyId: string) {
    const { logger } = createTraceLogger(`proposal-${companyId}`);
    logger.info({ companyId }, 'Starting proposal generation');

    // 1. Fetch Company Data
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single();

    if (companyError || !company) throw new Error('Company not found');

    // 2. Fetch Latest Audit
    const { data: website, error: websiteError } = await supabase
      .from('websites')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // 3. Fetch Latest AI Insights
    const { data: insight } = await supabase
      .from('company_insights')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // 4. Generate PDF
    const pdfBuffer = await this.createPdfBuffer(company, website, insight);

    // 5. Upload to Supabase Storage
    const fileName = `${companyId}/proposal-${Date.now()}.pdf`;
    
    // Ensure bucket exists in Supabase: "proposals"
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('proposals')
      .upload(fileName, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) {
      logger.error({ err: uploadError }, 'Failed to upload proposal to storage');
      throw uploadError;
    }

    // 6. Get Public URL
    const { data: publicUrlData } = supabase
      .storage
      .from('proposals')
      .getPublicUrl(fileName);

    const publicUrl = publicUrlData.publicUrl;

    // 7. Save metadata to DB
    const { data: proposalRecord, error: dbError } = await supabase
      .from('proposals')
      .insert([{
        company_id: companyId,
        storage_path: fileName,
        public_url: publicUrl
      }])
      .select()
      .single();

    if (dbError) {
      logger.error({ err: dbError }, 'Failed to save proposal record to DB');
      throw dbError;
    }

    logger.info({ companyId }, 'Proposal generated successfully');
    return proposalRecord;
  }

  async getProposals(companyId: string) {
    const { data, error } = await supabase
      .from('proposals')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  private createPdfBuffer(company: any, website: any, insight: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const buffers: Buffer[] = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        // Title Page
        doc.fontSize(24).text('Digital Strategy Proposal', { align: 'center' });
        doc.moveDown(1);
        doc.fontSize(16).text(`Prepared for: ${company.name || 'Client'}`, { align: 'center' });
        doc.moveDown(0.5);
        if (website?.url) {
          doc.fontSize(12).text(`Website: ${website.url}`, { align: 'center' });
        }
        doc.moveDown(3);

        // Problems Section
        doc.fontSize(18).text('Current Challenges', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(12).text(
          insight?.pain_points?.join('\n• ') || 
          '• Website speed is suboptimal.\n• Lack of clear conversion paths.\n• Insufficient lead generation mechanisms.'
        );
        doc.moveDown(2);

        // Solutions Section
        doc.fontSize(18).text('Proposed Solutions', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(12).text(
          insight?.opportunities?.join('\n• ') || 
          '• Implement a modern, high-performance web architecture.\n• Integrate an automated CRM pipeline.\n• Launch targeted multi-channel outreach campaigns.'
        );
        doc.moveDown(2);

        // Benefits Section
        doc.fontSize(18).text('Expected Benefits', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(12).text(
          '• Increased inbound lead volume by 40%.\n• Improved user engagement and lower bounce rates.\n• Automated workflows saving your sales team 10+ hours per week.'
        );
        doc.moveDown(2);

        // Pricing Placeholder
        doc.addPage();
        doc.fontSize(18).text('Investment & Next Steps', { underline: true });
        doc.moveDown(1);
        doc.fontSize(14).text('Phase 1: Foundation & Audit');
        doc.fontSize(12).text('$2,500 - $3,500');
        doc.moveDown(0.5);
        doc.fontSize(14).text('Phase 2: Build & Integration');
        doc.fontSize(12).text('$8,000 - $12,000');
        doc.moveDown(0.5);
        doc.fontSize(14).text('Phase 3: Ongoing Support (Monthly)');
        doc.fontSize(12).text('$1,500 / month');
        
        doc.moveDown(3);
        doc.fontSize(12).text('To move forward, please review this document and we will schedule a kickoff call.', { align: 'center' });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}
