import PDFDocument from 'pdfkit';
import { ProposalContent } from './ProposalTypes.js';

export class PdfGenerator {
  static async generate(content: ProposalContent): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const buffers: Buffer[] = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfData = Buffer.concat(buffers);
          resolve(pdfData);
        });

        // ================= HEADER =================
        doc
          .fontSize(24)
          .font('Helvetica-Bold')
          .fillColor('#2563eb')
          .text('Strategic Proposal', { align: 'right' });

        doc.moveDown(0.5);
        
        doc
          .fontSize(16)
          .fillColor('#1e293b')
          .text(`Prepared for: ${content.companyName}`, { align: 'right' });

        doc.moveDown(2);

        // ================= TITLE =================
        const titleMap = {
          'WEBSITE': 'Website Transformation Strategy',
          'CRM': 'CRM & Sales Operations Implementation',
          'WHATSAPP': 'WhatsApp Business Automation',
          'SEO': 'Search Engine Optimization Strategy'
        };

        doc
          .fontSize(28)
          .fillColor('#0f172a')
          .text(titleMap[content.type], { align: 'left' });

        doc.moveDown(2);

        // ================= CURRENT PROBLEMS =================
        doc
          .fontSize(16)
          .font('Helvetica-Bold')
          .fillColor('#dc2626')
          .text('1. Current Challenges', { underline: true });
        
        doc.moveDown(0.5);
        doc.fontSize(12).font('Helvetica').fillColor('#334155');
        content.currentProblems.forEach(problem => {
          doc.text(`• ${problem}`, { indent: 20 });
          doc.moveDown(0.2);
        });

        doc.moveDown(1.5);

        // ================= RECOMMENDED SOLUTION =================
        doc
          .fontSize(16)
          .font('Helvetica-Bold')
          .fillColor('#16a34a')
          .text('2. Recommended Solution', { underline: true });
        
        doc.moveDown(0.5);
        doc
          .fontSize(12)
          .font('Helvetica')
          .fillColor('#334155')
          .text(content.recommendedSolution, { lineGap: 4 });

        doc.moveDown(1.5);

        // ================= ESTIMATED BENEFITS =================
        doc
          .fontSize(16)
          .font('Helvetica-Bold')
          .fillColor('#2563eb')
          .text('3. Expected Benefits', { underline: true });
        
        doc.moveDown(0.5);
        doc.fontSize(12).font('Helvetica').fillColor('#334155');
        content.estimatedBenefits.forEach(benefit => {
          doc.text(`• ${benefit}`, { indent: 20 });
          doc.moveDown(0.2);
        });

        doc.moveDown(2);

        // ================= PRICING PLACEHOLDER =================
        doc
          .rect(50, doc.y, 495, 100)
          .fillAndStroke('#f8fafc', '#cbd5e1');

        doc
          .fillColor('#0f172a')
          .fontSize(14)
          .font('Helvetica-Bold')
          .text('Investment Summary', 70, doc.y - 80);

        doc.moveDown(0.5);
        
        doc
          .fontSize(12)
          .font('Helvetica')
          .fillColor('#475569')
          .text(content.pricingPlaceholder, 70, doc.y);

        // Finalize
        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }
}
