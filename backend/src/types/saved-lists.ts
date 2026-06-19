export interface SavedList {
  id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface SavedListInsert {
  name: string;
  description?: string;
  created_by?: string;
}

export interface SavedListCompany {
  list_id: string;
  company_id: string;
  added_at: Date;
}

export interface SavedListContact {
  list_id: string;
  contact_id: string;
  added_at: Date;
}

export interface SavedListDetails extends SavedList {
  companies: any[]; // Populated with joined company data
  contacts: any[];  // Populated with joined contact data
}
