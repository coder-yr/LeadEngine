-- ============================================================================
-- LeadEngine Phase 1: Database Schema
-- Database: PostgreSQL (Supabase)
-- Created: 2026-06-10
-- ============================================================================

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For full-text search on strings


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
  
  -- Basic Information
  name VARCHAR(255) NOT NULL,
  website_url VARCHAR(512),
  description TEXT,
  industry VARCHAR(255),
  
  -- Company Details
  size company_size,
  founded_year INTEGER,
  annual_revenue VARCHAR(100),
  employee_count INTEGER,
  
  -- Location
  country VARCHAR(100),
  state_province VARCHAR(100),
  city VARCHAR(100),
  postal_code VARCHAR(20),
  
  -- Contact Information
  phone VARCHAR(20),
  email VARCHAR(255),
  
  -- Status & Metadata
  status company_status DEFAULT 'prospect',
  last_contacted_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  
  -- Audit & Enrichment
  is_verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMP WITH TIME ZONE,
  enriched_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  -- Audit
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
  
  -- Foreign Key
  company_id UUID NOT NULL,
  
  -- Basic Information
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  
  -- Professional Details
  title VARCHAR(255),
  department VARCHAR(100),
  linkedin_url VARCHAR(512),
  twitter_handle VARCHAR(100),
  
  -- Status & Preferences
  status contact_status DEFAULT 'new',
  is_decision_maker BOOLEAN DEFAULT FALSE,
  is_primary_contact BOOLEAN DEFAULT FALSE,
  
  -- Engagement
  last_contacted_at TIMESTAMP WITH TIME ZONE,
  contact_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  
  -- Validation
  email_verified BOOLEAN DEFAULT FALSE,
  phone_verified BOOLEAN DEFAULT FALSE,
  email_verified_at TIMESTAMP WITH TIME ZONE,
  phone_verified_at TIMESTAMP WITH TIME ZONE,
  
  -- Notes
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  -- Audit
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
  
  -- Foreign Key
  company_id UUID NOT NULL,
  
  -- Website Information
  url VARCHAR(512) NOT NULL UNIQUE,
  domain_name VARCHAR(255) NOT NULL,
  
  -- Status & Metadata
  status website_status DEFAULT 'pending_audit',
  is_primary BOOLEAN DEFAULT TRUE,
  last_crawled_at TIMESTAMP WITH TIME ZONE,
  last_audit_at TIMESTAMP WITH TIME ZONE,
  
  -- Technical Details
  has_ssl BOOLEAN DEFAULT FALSE,
  ssl_expiry_date DATE,
  is_mobile_friendly BOOLEAN,
  page_speed_score INTEGER,  -- 0-100
  
  -- SEO Metrics
  seo_score INTEGER,  -- 0-100
  meta_description TEXT,
  h1_tags TEXT[],
  
  -- Features Detection
  has_contact_form BOOLEAN DEFAULT FALSE,
  has_whatsapp_widget BOOLEAN DEFAULT FALSE,
  has_booking_system BOOLEAN DEFAULT FALSE,
  has_crm_integration BOOLEAN DEFAULT FALSE,
  
  -- Content
  homepage_title VARCHAR(512),
  homepage_description TEXT,
  
  -- Last Crawl Data
  last_crawl_status_code INTEGER,
  last_crawl_error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  -- Audit
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
  
  -- Foreign Key
  company_id UUID NOT NULL,
  
  -- Campaign Information
  name VARCHAR(255) NOT NULL,
  description TEXT,
  campaign_type campaign_type NOT NULL,
  
  -- Status & Dates
  status campaign_status DEFAULT 'draft',
  starts_at TIMESTAMP WITH TIME ZONE,
  ends_at TIMESTAMP WITH TIME ZONE,
  
  -- Configuration
  target_count INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  replied_count INTEGER DEFAULT 0,
  
  -- Metrics
  open_rate NUMERIC(5, 2),  -- Percentage
  click_rate NUMERIC(5, 2),
  reply_rate NUMERIC(5, 2),
  
  -- Budget (if applicable)
  budget NUMERIC(12, 2),
  spent NUMERIC(12, 2) DEFAULT 0,
  
  -- Configuration
  settings JSONB DEFAULT '{}',  -- For flexible campaign settings
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  -- Audit
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
  
  -- Foreign Keys
  campaign_id UUID,
  contact_id UUID NOT NULL,
  company_id UUID NOT NULL,
  
  -- Message Information
  message_type message_type NOT NULL,
  status message_status DEFAULT 'draft',
  
  -- Content
  subject VARCHAR(512),
  body TEXT NOT NULL,
  
  -- Delivery Tracking
  scheduled_for TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  replied_at TIMESTAMP WITH TIME ZONE,
  
  -- Error Tracking
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  last_retry_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  from_address VARCHAR(255),
  to_address VARCHAR(255) NOT NULL,
  
  -- Engagement
  is_read BOOLEAN DEFAULT FALSE,
  is_replied BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  -- Audit
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
  
  -- Foreign Keys
  company_id UUID NOT NULL,
  contact_id UUID,
  campaign_id UUID,
  message_id UUID,
  
  -- Activity Information
  activity_type activity_type NOT NULL,
  description TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',  -- For flexible activity data
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  -- Audit
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

-- Enable RLS on all tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE websites ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- Create policies (assuming authenticated users can see all company data)
-- These are basic policies - adjust based on your auth model

CREATE POLICY "Users can view their own companies" ON companies
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can insert companies" ON companies
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND created_by = auth.uid()
  );

CREATE POLICY "Users can update companies" ON companies
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND created_by = auth.uid()
  );

CREATE POLICY "Users can view contacts" ON contacts
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can insert contacts" ON contacts
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND created_by = auth.uid()
  );

CREATE POLICY "Users can view websites" ON websites
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can view campaigns" ON campaigns
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can view messages" ON messages
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can view activities" ON activities
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
  );


-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE companies IS 'Core company records for leads and prospects';
COMMENT ON TABLE contacts IS 'Individual contacts associated with companies';
COMMENT ON TABLE websites IS 'Website information and audit data';
COMMENT ON TABLE campaigns IS 'Marketing and outreach campaigns';
COMMENT ON TABLE messages IS 'Sent/received messages and communications';
COMMENT ON TABLE activities IS 'Audit trail of all activities and interactions';

COMMENT ON COLUMN companies.status IS 'Current status: prospect, active, inactive, or churned';
COMMENT ON COLUMN contacts.status IS 'Contact engagement status';
COMMENT ON COLUMN websites.status IS 'Website status: active, inactive, error, or pending_audit';
COMMENT ON COLUMN campaigns.status IS 'Campaign status: draft, active, paused, completed, or archived';
COMMENT ON COLUMN messages.status IS 'Message delivery status';
COMMENT ON COLUMN activities.activity_type IS 'Type of activity that occurred';
