import { z } from 'zod';

export interface AuditIssue {
  type: 'seo' | 'performance' | 'security' | 'conversion';
  message: string;
  severity: 'high' | 'medium' | 'low';
}

export interface AuditResult {
  url: string;
  seoScore: number;
  mobileFriendly: boolean;
  sslEnabled: boolean;
  pageSpeedEstimate: number;
  hasContactForm: boolean;
  hasWhatsAppWidget: boolean;
  socialLinksFound: string[];
  auditSummary: string;
  issues: AuditIssue[];
}

export const AuditResultSchema = z.object({
  url: z.string().url(),
  seoScore: z.number().min(0).max(100),
  mobileFriendly: z.boolean(),
  sslEnabled: z.boolean(),
  pageSpeedEstimate: z.number().min(0).max(100),
  hasContactForm: z.boolean(),
  hasWhatsAppWidget: z.boolean(),
  socialLinksFound: z.array(z.string()),
  auditSummary: z.string(),
  issues: z.array(z.object({
    type: z.enum(['seo', 'performance', 'security', 'conversion']),
    message: z.string(),
    severity: z.enum(['high', 'medium', 'low'])
  }))
});
