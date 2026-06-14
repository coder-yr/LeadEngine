CREATE TABLE website_audits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  seo_score INTEGER CHECK (seo_score >= 0 AND seo_score <= 100),
  mobile_friendly BOOLEAN DEFAULT FALSE,
  ssl_enabled BOOLEAN DEFAULT FALSE,
  page_speed_estimate INTEGER CHECK (page_speed_estimate >= 0 AND page_speed_estimate <= 100),
  has_contact_form BOOLEAN DEFAULT FALSE,
  has_whatsapp_widget BOOLEAN DEFAULT FALSE,
  social_links_found JSONB DEFAULT '[]',
  audit_summary TEXT,
  issues JSONB DEFAULT '[]',
  audited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_website_audits_company_id ON website_audits(company_id);
