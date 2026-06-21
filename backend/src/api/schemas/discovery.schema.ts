import { z } from 'zod';

export const discoverySearchSchema = z.object({
  keyword: z.string().min(1, "Keyword is required").trim(),
  city: z.string().min(1, "City is required").trim(),
  sources: z.array(z.enum([
    'google_maps', 'duckduckgo', 'website_search', 'grotal', 'asklaila', 'yellowpages', 'hotfrog'
  ])).optional().default(['google_maps', 'duckduckgo', 'website_search', 'grotal', 'asklaila']),
  max_results: z.number().int().min(1).max(200).optional().default(50),
});

export type DiscoverySearchInput = z.infer<typeof discoverySearchSchema>;

export const discoveryJobQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
  status: z.enum(['pending', 'running', 'completed', 'failed']).optional(),
});

export const bulkAnalyzeSchema = z.object({
  resultIds: z.array(z.string().uuid()).min(1, "At least one result ID is required"),
  reanalyze: z.boolean().optional().default(false),
});

export type BulkAnalyzeInput = z.infer<typeof bulkAnalyzeSchema>;
