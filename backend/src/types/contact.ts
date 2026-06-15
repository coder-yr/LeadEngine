export interface Contact {
  id: string;
  company_id: string;
  name: string;
  title: string | null;
  department: string | null;
  linkedin: string | null;
  email: string | null;
  phone: string | null;
  decision_maker_score: number;
  created_at?: Date;
  updated_at?: Date;
}

export type ContactInsert = Omit<Contact, 'id' | 'created_at' | 'updated_at'>;
