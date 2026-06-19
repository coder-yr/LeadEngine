export interface Contact {
  id: string;
  company_id: string;
  first_name: string;
  last_name: string;
  title: string | null;
  department: string | null;
  linkedin_url: string | null;
  twitter_handle?: string | null;
  email: string | null;
  phone: string | null;
  status: 'new' | 'contacted' | 'replied' | 'qualified' | 'unqualified' | 'bounced' | 'do_not_contact';
  is_decision_maker: boolean;
  is_primary_contact: boolean;
  last_contacted_at?: Date | null;
  contact_count?: number;
  reply_count?: number;
  email_verified?: boolean;
  phone_verified?: boolean;
  email_verified_at?: Date | null;
  phone_verified_at?: Date | null;
  notes?: string | null;
  source?: string | null;
  confidence_score?: number | null;
  confidence_reason?: string | null;
  verification_status?: string | null;
  last_verified_at?: Date | null;
  created_at?: Date;
  updated_at?: Date;
}

export type ContactInsert = Omit<Contact, 'id' | 'created_at' | 'updated_at'>;
