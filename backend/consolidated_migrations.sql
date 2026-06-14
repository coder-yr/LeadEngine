-- ============================================================================
-- LeadEngine Phase 1 - Migration File
-- Migration Name: 001_create_base_schema
-- Created: 2026-06-10
-- ============================================================================
-- This migration creates the base schema for Phase 1
-- Run this migration to initialize the database
-- ============================================================================

BEGIN;

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";


-- ============================================================================
-- ENUM TYPES
-- ============================================================================

CREATE TYPE company_size AS ENUM (
  'solopreneur',
  '1-10',
  '10-50',
  '50-100',
  '100-500',
  '500-1000',
  '1000+'
);

CREATE TYPE company_status AS ENUM (
  'prospect',
  'active',
  'inactive',
  'churned'
);

CREATE TYPE contact_status AS ENUM (
  'new',
  'contacted',
  'engaged',
  'converted',
  'unresponsive'
);

CREATE TYPE website_status AS ENUM (
  'active',
  'inactive',
  'error',
  'pending_audit'
);

CREATE TYPE campaign_status AS ENUM (
  'draft',
  'active',
  'paused',
  'completed',
  'archived'
);

CREATE TYPE campaign_type AS ENUM (
  'cold_email',
  'outreach',
  'follow_up',
  'proposal',
  'custom'
);

CREATE TYPE activity_type AS ENUM (
  'email_sent',
  'email_opened',
  'link_clicked',
  'call_made',
  'meeting_scheduled',
  'proposal_sent',
  'proposal_signed',
  'note_added',
  'contact_enriched',
  'website_crawled',
  'lead_scored',
  'audit_completed'
);

CREATE TYPE message_status AS ENUM (
  'draft',
  'scheduled',
  'sent',
  'delivered',
  'failed',
  'bounced'
);

CREATE TYPE message_type AS ENUM (
  'email',
  'sms',
  'whatsapp',
  'linkedin',
  'cold_call'
);


-- ============================================================================
-- COMPANIES TABLE
-- ============================================================================

CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  website_url VARCHAR(512),
  description TEXT,
  industry VARCHAR(255),
  size company_size,
  founded_year INTEGER,
  annual_revenue VARCHAR(100),
  employee_count INTEGER,
  country VARCHAR(100),
  state_province VARCHAR(100),
  city VARCHAR(100),
  postal_code VARCHAR(20),
  phone VARCHAR(20),
  email VARCHAR(255),
  status company_status DEFAULT 'prospect',
  last_contacted_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMP WITH TIME ZONE,
  enriched_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by UUID,
  updated_by UUID,
  CONSTRAINT companies_name_not_empty CHECK (LENGTH(TRIM(name)) > 0)
);

CREATE INDEX idx_companies_name ON companies USING GIN (name gin_trgm_ops);
CREATE INDEX idx_companies_website_url ON companies(website_url);
CREATE INDEX idx_companies_industry ON companies(industry);
CREATE INDEX idx_companies_status ON companies(status);
CREATE INDEX idx_companies_created_at ON companies(created_at DESC);
CREATE INDEX idx_companies_country_state ON companies(country, state_province);


-- ============================================================================
-- CONTACTS TABLE
-- ============================================================================

CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  title VARCHAR(255),
  department VARCHAR(100),
  linkedin_url VARCHAR(512),
  twitter_handle VARCHAR(100),
  status contact_status DEFAULT 'new',
  is_decision_maker BOOLEAN DEFAULT FALSE,
  is_primary_contact BOOLEAN DEFAULT FALSE,
  last_contacted_at TIMESTAMP WITH TIME ZONE,
  contact_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  email_verified BOOLEAN DEFAULT FALSE,
  phone_verified BOOLEAN DEFAULT FALSE,
  email_verified_at TIMESTAMP WITH TIME ZONE,
  phone_verified_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by UUID,
  updated_by UUID,
  CONSTRAINT fk_contacts_company FOREIGN KEY (company_id) 
    REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT contacts_first_name_not_empty CHECK (LENGTH(TRIM(first_name)) > 0),
  CONSTRAINT contacts_last_name_not_empty CHECK (LENGTH(TRIM(last_name)) > 0),
  CONSTRAINT contacts_email_or_phone CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE INDEX idx_contacts_company_id ON contacts(company_id);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_phone ON contacts(phone);
CREATE INDEX idx_contacts_name ON contacts USING GIN (
  (first_name || ' ' || last_name) gin_trgm_ops
);
CREATE INDEX idx_contacts_status ON contacts(status);
CREATE INDEX idx_contacts_created_at ON contacts(created_at DESC);
CREATE INDEX idx_contacts_is_decision_maker ON contacts(is_decision_maker);


-- ============================================================================
-- WEBSITES TABLE
-- ============================================================================

CREATE TABLE websites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL,
  url VARCHAR(512) NOT NULL UNIQUE,
  domain_name VARCHAR(255) NOT NULL,
  status website_status DEFAULT 'pending_audit',
  is_primary BOOLEAN DEFAULT TRUE,
  last_crawled_at TIMESTAMP WITH TIME ZONE,
  last_audit_at TIMESTAMP WITH TIME ZONE,
  has_ssl BOOLEAN DEFAULT FALSE,
  ssl_expiry_date DATE,
  is_mobile_friendly BOOLEAN,
  page_speed_score INTEGER,
  seo_score INTEGER,
  meta_description TEXT,
  h1_tags TEXT[],
  has_contact_form BOOLEAN DEFAULT FALSE,
  has_whatsapp_widget BOOLEAN DEFAULT FALSE,
  has_booking_system BOOLEAN DEFAULT FALSE,
  has_crm_integration BOOLEAN DEFAULT FALSE,
  homepage_title VARCHAR(512),
  homepage_description TEXT,
  last_crawl_status_code INTEGER,
  last_crawl_error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by UUID,
  updated_by UUID,
  CONSTRAINT fk_websites_company FOREIGN KEY (company_id) 
    REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT websites_url_not_empty CHECK (LENGTH(TRIM(url)) > 0),
  CONSTRAINT websites_seo_score_range CHECK (seo_score >= 0 AND seo_score <= 100),
  CONSTRAINT websites_speed_score_range CHECK (page_speed_score >= 0 AND page_speed_score <= 100)
);

CREATE INDEX idx_websites_company_id ON websites(company_id);
CREATE INDEX idx_websites_url ON websites(url);
CREATE INDEX idx_websites_domain ON websites(domain_name);
CREATE INDEX idx_websites_status ON websites(status);
CREATE INDEX idx_websites_created_at ON websites(created_at DESC);


-- ============================================================================
-- CAMPAIGNS TABLE
-- ============================================================================

CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  campaign_type campaign_type NOT NULL,
  status campaign_status DEFAULT 'draft',
  starts_at TIMESTAMP WITH TIME ZONE,
  ends_at TIMESTAMP WITH TIME ZONE,
  target_count INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  replied_count INTEGER DEFAULT 0,
  open_rate NUMERIC(5, 2),
  click_rate NUMERIC(5, 2),
  reply_rate NUMERIC(5, 2),
  budget NUMERIC(12, 2),
  spent NUMERIC(12, 2) DEFAULT 0,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by UUID,
  updated_by UUID,
  CONSTRAINT fk_campaigns_company FOREIGN KEY (company_id) 
    REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT campaigns_name_not_empty CHECK (LENGTH(TRIM(name)) > 0),
  CONSTRAINT campaigns_dates CHECK (starts_at IS NULL OR ends_at IS NULL OR starts_at <= ends_at),
  CONSTRAINT campaigns_open_rate_range CHECK (open_rate >= 0 AND open_rate <= 100),
  CONSTRAINT campaigns_click_rate_range CHECK (click_rate >= 0 AND click_rate <= 100),
  CONSTRAINT campaigns_reply_rate_range CHECK (reply_rate >= 0 AND reply_rate <= 100)
);

CREATE INDEX idx_campaigns_company_id ON campaigns(company_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_type ON campaigns(campaign_type);
CREATE INDEX idx_campaigns_created_at ON campaigns(created_at DESC);
CREATE INDEX idx_campaigns_date_range ON campaigns(starts_at, ends_at);


-- ============================================================================
-- MESSAGES TABLE
-- ============================================================================

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID,
  contact_id UUID NOT NULL,
  company_id UUID NOT NULL,
  message_type message_type NOT NULL,
  status message_status DEFAULT 'draft',
  subject VARCHAR(512),
  body TEXT NOT NULL,
  scheduled_for TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  replied_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  last_retry_at TIMESTAMP WITH TIME ZONE,
  from_address VARCHAR(255),
  to_address VARCHAR(255) NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  is_replied BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by UUID,
  updated_by UUID,
  CONSTRAINT fk_messages_campaign FOREIGN KEY (campaign_id) 
    REFERENCES campaigns(id) ON DELETE SET NULL,
  CONSTRAINT fk_messages_contact FOREIGN KEY (contact_id) 
    REFERENCES contacts(id) ON DELETE CASCADE,
  CONSTRAINT fk_messages_company FOREIGN KEY (company_id) 
    REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT messages_body_not_empty CHECK (LENGTH(TRIM(body)) > 0)
);

CREATE INDEX idx_messages_campaign_id ON messages(campaign_id);
CREATE INDEX idx_messages_contact_id ON messages(contact_id);
CREATE INDEX idx_messages_company_id ON messages(company_id);
CREATE INDEX idx_messages_status ON messages(status);
CREATE INDEX idx_messages_type ON messages(message_type);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_messages_sent_at ON messages(sent_at);
CREATE INDEX idx_messages_scheduled_for ON messages(scheduled_for) 
  WHERE status = 'scheduled';


-- ============================================================================
-- ACTIVITIES TABLE
-- ============================================================================

CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL,
  contact_id UUID,
  campaign_id UUID,
  message_id UUID,
  activity_type activity_type NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by UUID,
  CONSTRAINT fk_activities_company FOREIGN KEY (company_id) 
    REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_activities_contact FOREIGN KEY (contact_id) 
    REFERENCES contacts(id) ON DELETE SET NULL,
  CONSTRAINT fk_activities_campaign FOREIGN KEY (campaign_id) 
    REFERENCES campaigns(id) ON DELETE SET NULL,
  CONSTRAINT fk_activities_message FOREIGN KEY (message_id) 
    REFERENCES messages(id) ON DELETE SET NULL
);

CREATE INDEX idx_activities_company_id ON activities(company_id);
CREATE INDEX idx_activities_contact_id ON activities(contact_id);
CREATE INDEX idx_activities_campaign_id ON activities(campaign_id);
CREATE INDEX idx_activities_type ON activities(activity_type);
CREATE INDEX idx_activities_created_at ON activities(created_at DESC);
CREATE INDEX idx_activities_company_created ON activities(company_id, created_at DESC);


-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_companies_updated_at
BEFORE UPDATE ON companies
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_contacts_updated_at
BEFORE UPDATE ON contacts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_websites_updated_at
BEFORE UPDATE ON websites
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_campaigns_updated_at
BEFORE UPDATE ON campaigns
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_messages_updated_at
BEFORE UPDATE ON messages
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_activities_updated_at
BEFORE UPDATE ON activities
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE websites ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own companies" ON companies
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert companies" ON companies
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

CREATE POLICY "Users can update companies" ON companies
  FOR UPDATE
  USING (auth.uid() IS NOT NULL AND created_by = auth.uid());

CREATE POLICY "Users can view contacts" ON contacts
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert contacts" ON contacts
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

CREATE POLICY "Users can view websites" ON websites
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view campaigns" ON campaigns
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view messages" ON messages
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view activities" ON activities
  FOR SELECT
  USING (auth.uid() IS NOT NULL);


-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE companies IS 'Core company records for leads and prospects';
COMMENT ON TABLE contacts IS 'Individual contacts associated with companies';
COMMENT ON TABLE websites IS 'Website information and audit data';
COMMENT ON TABLE campaigns IS 'Marketing and outreach campaigns';
COMMENT ON TABLE messages IS 'Sent/received messages and communications';
COMMENT ON TABLE activities IS 'Audit trail of all activities and interactions';

COMMIT;
-- ============================================================================
-- LeadEngine Phase 6 - Migration File
-- Migration Name: 002_create_company_intelligence
-- Created: 2026-06-13
-- ============================================================================
-- This migration creates the company_intelligence schema for the new Apollo-style
-- Lead Intelligence Platform Module.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS company_intelligence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  website_exists BOOLEAN DEFAULT FALSE,
  website_score INTEGER CHECK (website_score >= 0 AND website_score <= 100),
  crm_detected BOOLEAN DEFAULT FALSE,
  booking_detected BOOLEAN DEFAULT FALSE,
  whatsapp_detected BOOLEAN DEFAULT FALSE,
  contact_form_detected BOOLEAN DEFAULT FALSE,
  social_profiles JSONB DEFAULT '[]',
  digital_maturity_score INTEGER CHECK (digital_maturity_score >= 0 AND digital_maturity_score <= 100),
  services_needed JSONB DEFAULT '[]',
  lead_score INTEGER CHECK (lead_score >= 0 AND lead_score <= 100),
  analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_company_intelligence_company_id ON company_intelligence(company_id);
CREATE INDEX IF NOT EXISTS idx_company_intelligence_lead_score ON company_intelligence(lead_score DESC);

-- Trigger to automatically update the 'updated_at' column on modification
CREATE TRIGGER trigger_company_intelligence_updated_at
BEFORE UPDATE ON company_intelligence
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE company_intelligence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company_intelligence" ON company_intelligence
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert company_intelligence" ON company_intelligence
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update company_intelligence" ON company_intelligence
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

COMMENT ON TABLE company_intelligence IS 'Stores the digital footprint and intelligence scoring for Apollo-style company filtering';

COMMIT;
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
-- ============================================================================
-- LeadEngine - Migration File
-- Migration Name: 004_create_company_ai_insights
-- Created: 2026-06-13
-- ============================================================================
-- This migration creates the company_ai_insights table for storing the 
-- Ollama-generated AI insights.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS company_ai_insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  opportunity_score INTEGER NOT NULL CHECK (opportunity_score >= 0 AND opportunity_score <= 100),
  services_needed JSONB DEFAULT '[]',
  reasoning TEXT NOT NULL,
  recommended_next_action TEXT NOT NULL,
  model_used VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Prevent multiple active insights per company if we want a 1:1 relationship, 
  -- but allowing multiple allows for history. For now, let's keep one primary insight by making it unique.
  UNIQUE(company_id)
);

-- Index for querying insights easily
CREATE INDEX IF NOT EXISTS idx_company_ai_insights_company_id ON company_ai_insights(company_id);

-- Trigger for updated_at
CREATE TRIGGER trigger_company_ai_insights_updated_at
BEFORE UPDATE ON company_ai_insights
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE company_ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company_ai_insights" ON company_ai_insights
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert company_ai_insights" ON company_ai_insights
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update company_ai_insights" ON company_ai_insights
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

COMMENT ON TABLE company_ai_insights IS 'Stores AI-generated intelligence and sales consulting insights produced by Ollama';

COMMIT;
