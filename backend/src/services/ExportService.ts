import { DiscoveryResultRepository } from '../db/repositories/DiscoveryResultRepository.js';
import { DiscoveryJobRepository } from '../db/repositories/DiscoveryJobRepository.js';
import * as xlsx from 'xlsx';
import { supabase } from '../config/supabase.js';

export class ExportService {
  private resultRepo = new DiscoveryResultRepository();
  private jobRepo = new DiscoveryJobRepository();

  /**
   * Export discovery results to CSV string.
   */
  async exportCSV(jobId: string): Promise<string> {
    const results = await this.resultRepo.getResultsWithCompanies(jobId);
    
    if (results.length === 0) {
      return 'Company Name,Phone,Email,Website,Address,Source,Lead Score,Pipeline Stage\n';
    }

    const header = ['Company Name', 'Phone', 'Email', 'Website', 'Address', 'Source', 'Lead Score', 'Pipeline Stage'];
    
    const rows = results.map(r => {
      const company = r.companies;
      return [
        this.escapeCSV(company?.name || r.raw_name || ''),
        this.escapeCSV(company?.phone || r.raw_phone || ''),
        this.escapeCSV(r.raw_email || ''), // companies don't usually store email at top level yet, contacts do, but we keep raw email
        this.escapeCSV(company?.website_url || r.raw_website || ''),
        this.escapeCSV(r.raw_address || ''),
        this.escapeCSV(r.source || ''),
        this.escapeCSV(company?.lead_score?.toString() || ''),
        this.escapeCSV(company?.pipeline_stage || '')
      ];
    });

    return [header, ...rows].map(row => row.join(',')).join('\n');
  }

  /**
   * Export discovery results to an XLSX buffer with multiple sheets.
   */
  async exportXLSX(jobId: string): Promise<Buffer> {
    const results = await this.resultRepo.getResultsWithCompanies(jobId);
    
    // Create a new workbook
    const wb = xlsx.utils.book_new();

    // Sheet 1: Companies
    const companyData = results.map(r => {
      const company = r.companies;
      return {
        'Company Name': company?.name || r.raw_name || '',
        'Phone': company?.phone || r.raw_phone || '',
        'Email': r.raw_email || '',
        'Website': company?.website_url || r.raw_website || '',
        'Address': r.raw_address || '',
        'Industry': company?.industry || '',
        'Source': r.source || '',
        'Lead Score': company?.lead_score || 0,
        'Pipeline Stage': company?.pipeline_stage || ''
      };
    });
    
    const companySheet = xlsx.utils.json_to_sheet(companyData);
    xlsx.utils.book_append_sheet(wb, companySheet, 'Companies');

    // Fetch related contacts and intelligence for the companies
    const companyIds = results.map(r => r.companies?.id).filter(Boolean) as string[];
    
    if (companyIds.length > 0) {
      // Sheet 2: Contacts
      const { data: contacts } = await supabase
        .from('contacts')
        .select('*, companies(name)')
        .in('company_id', companyIds);

      if (contacts && contacts.length > 0) {
        const contactData = contacts.map(c => ({
          'Company Name': c.companies?.name || '',
          'First Name': c.first_name || '',
          'Last Name': c.last_name || '',
          'Email': c.email || '',
          'Phone': c.phone || '',
          'Title': c.title || '',
          'Is Decision Maker': c.is_decision_maker ? 'Yes' : 'No',
          'LinkedIn': c.linkedin_url || ''
        }));
        const contactSheet = xlsx.utils.json_to_sheet(contactData);
        xlsx.utils.book_append_sheet(wb, contactSheet, 'Contacts');
      }

      // Sheet 3: Intelligence
      const { data: intelligence } = await supabase
        .from('company_intelligence')
        .select('*, companies(name)')
        .in('company_id', companyIds);

      if (intelligence && intelligence.length > 0) {
        const intelData = intelligence.map(i => ({
          'Company Name': i.companies?.name || '',
          'Digital Maturity Score': i.digital_maturity_score || 0,
          'Services Needed': Array.isArray(i.services_needed) ? i.services_needed.join(', ') : '',
          'CRM Detected': i.crm_detected ? 'Yes' : 'No',
          'WhatsApp Detected': i.whatsapp_detected ? 'Yes' : 'No',
          'Booking Detected': i.booking_detected ? 'Yes' : 'No',
          'Summary': i.summary || ''
        }));
        const intelSheet = xlsx.utils.json_to_sheet(intelData);
        xlsx.utils.book_append_sheet(wb, intelSheet, 'Intelligence');
      }
    }

    // Write to buffer
    // @ts-ignore - buffer type is valid for write in node
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return buffer as Buffer;
  }

  private escapeCSV(val: string): string {
    if (!val) return '';
    const stringVal = String(val);
    if (stringVal.includes(',') || stringVal.includes('"') || stringVal.includes('\n')) {
      return `"${stringVal.replace(/"/g, '""')}"`;
    }
    return stringVal;
  }
}
