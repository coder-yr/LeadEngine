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
  hasCrm: boolean;
  hasBookingSystem: boolean;
  hasChatbot: boolean;
  hasAnalytics: boolean;
  socialLinksFound: string[];
  auditSummary: string;
  issues: AuditIssue[];
  extractedCompanyInfo?: {
    city?: string;
    state_province?: string;
    country?: string;
    employee_count?: number;
    industry?: string;
    industry_confidence?: number;
    description?: string;
    business_model?: string;
    target_audience?: string;
    services_offered?: string[];
  };
  fetchTimeMs?: number;
  parseTimeMs?: number;
  aiTimeMs?: number;
  totalTimeMs?: number;
  debug?: {
    ollama?: {
      promptPreview?: string;
      rawOllamaResponse?: string;
      parsedJson?: any;
      parseError?: string;
    };
  };
}

export const AuditResultSchema = z.object({
  url: z.string().url(),
  seoScore: z.number().min(0).max(100),
  mobileFriendly: z.boolean(),
  sslEnabled: z.boolean(),
  pageSpeedEstimate: z.number().min(0).max(100),
  hasContactForm: z.boolean(),
  hasWhatsAppWidget: z.boolean(),
  hasCrm: z.boolean(),
  hasBookingSystem: z.boolean(),
  hasChatbot: z.boolean(),
  hasAnalytics: z.boolean(),
  socialLinksFound: z.array(z.string()),
  auditSummary: z.string(),
  issues: z.array(z.object({
    type: z.enum(['seo', 'performance', 'security', 'conversion']),
    message: z.string(),
    severity: z.enum(['high', 'medium', 'low'])
  })),
  fetchTimeMs: z.number().optional(),
  parseTimeMs: z.number().optional(),
  aiTimeMs: z.number().optional(),
  totalTimeMs: z.number().optional(),
});
