export type ProposalType = 'WEBSITE' | 'CRM' | 'WHATSAPP' | 'SEO';

export interface ProposalRequest {
  companyId: string;
  type: ProposalType;
}

export interface ProposalContent {
  companyName: string;
  type: ProposalType;
  currentProblems: string[];
  recommendedSolution: string;
  estimatedBenefits: string[];
  pricingPlaceholder: string;
}
