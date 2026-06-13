import { z } from 'zod';

export const discoverySearchSchema = z.object({
  keyword: z.string().min(1, "Keyword is required").trim(),
  city: z.string().min(1, "City is required").trim()
});

export type DiscoverySearchInput = z.infer<typeof discoverySearchSchema>;
