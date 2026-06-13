-- ============================================================================
-- LeadEngine Phase 1: Sample Data Seed
-- Database: PostgreSQL (Supabase)
-- Purpose: Development/Testing data
-- ============================================================================

-- Set session variables for user tracking
-- Note: In production, these would come from actual auth users
SELECT set_config('app.current_user_id', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', false);


-- ============================================================================
-- COMPANIES
-- ============================================================================

INSERT INTO companies (
  id, name, website_url, description, industry, size, founded_year, 
  country, state_province, city, email, status, is_verified, created_by
) VALUES

-- Tech Company
(
  '550e8400-e29b-41d4-a716-446655440001',
  'TechFlow Solutions',
  'https://techflow.example.com',
  'Cloud infrastructure and DevOps solutions provider',
  'Technology',
  '10-50',
  2018,
  'United States',
  'California',
  'San Francisco',
  'hello@techflow.example.com',
  'prospect',
  FALSE,
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'
),

-- Marketing Agency
(
  '550e8400-e29b-41d4-a716-446655440002',
  'Digital Rise Marketing',
  'https://digitalrise.example.com',
  'Full-service digital marketing agency',
  'Marketing & Advertising',
  '50-100',
  2015,
  'United States',
  'Texas',
  'Austin',
  'info@digitalrise.example.com',
  'prospect',
  FALSE,
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'
),

-- E-commerce Business
(
  '550e8400-e29b-41d4-a716-446655440003',
  'ShopHub Inc',
  'https://shophub.example.com',
  'E-commerce platform for small businesses',
  'E-commerce',
  '1-10',
  2019,
  'United States',
  'New York',
  'New York',
  'contact@shophub.example.com',
  'prospect',
  FALSE,
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'
),

-- Consulting Firm
(
  '550e8400-e29b-41d4-a716-446655440004',
  'Strategy Partners LLC',
  'https://strategypartners.example.com',
  'Business strategy and management consulting',
  'Consulting',
  '50-100',
  2010,
  'United States',
  'Illinois',
  'Chicago',
  'partners@strategy.example.com',
  'prospect',
  FALSE,
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'
),

-- Startup
(
  '550e8400-e29b-41d4-a716-446655440005',
  'DataViz Analytics',
  'https://dataviz.example.com',
  'Real-time business intelligence and analytics',
  'Software/SaaS',
  'solopreneur',
  2023,
  'United States',
  'Massachusetts',
  'Boston',
  'hello@dataviz.example.com',
  'prospect',
  FALSE,
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'
);


-- ============================================================================
-- CONTACTS
-- ============================================================================

INSERT INTO contacts (
  id, company_id, first_name, last_name, email, phone, title, department,
  status, is_decision_maker, is_primary_contact, created_by
) VALUES

-- TechFlow Solutions Contacts
(
  '550e8400-e29b-41d4-a716-446655440101',
  '550e8400-e29b-41d4-a716-446655440001',
  'John',
  'Anderson',
  'john.anderson@techflow.example.com',
  '+1-555-0101',
  'Chief Technology Officer',
  'Technology',
  'new',
  TRUE,
  TRUE,
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'
),

(
  '550e8400-e29b-41d4-a716-446655440102',
  '550e8400-e29b-41d4-a716-446655440001',
  'Sarah',
  'Chen',
  'sarah.chen@techflow.example.com',
  '+1-555-0102',
  'Director of Operations',
  'Operations',
  'new',
  FALSE,
  FALSE,
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'
),

-- Digital Rise Marketing Contacts
(
  '550e8400-e29b-41d4-a716-446655440201',
  '550e8400-e29b-41d4-a716-446655440002',
  'Michael',
  'Thompson',
  'michael@digitalrise.example.com',
  '+1-555-0201',
  'Chief Executive Officer',
  'Executive',
  'new',
  TRUE,
  TRUE,
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'
),

(
  '550e8400-e29b-41d4-a716-446655440202',
  '550e8400-e29b-41d4-a716-446655440002',
  'Emily',
  'Rodriguez',
  'emily@digitalrise.example.com',
  '+1-555-0202',
  'Marketing Manager',
  'Marketing',
  'new',
  FALSE,
  FALSE,
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'
),

-- ShopHub Inc Contacts
(
  '550e8400-e29b-41d4-a716-446655440301',
  '550e8400-e29b-41d4-a716-446655440003',
  'David',
  'Kumar',
  'david@shophub.example.com',
  '+1-555-0301',
  'Founder & CEO',
  'Executive',
  'new',
  TRUE,
  TRUE,
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'
),

-- Strategy Partners Contacts
(
  '550e8400-e29b-41d4-a716-446655440401',
  '550e8400-e29b-41d4-a716-446655440004',
  'Jessica',
  'Lee',
  'jlee@strategypartners.example.com',
  '+1-555-0401',
  'Senior Partner',
  'Management',
  'new',
  TRUE,
  TRUE,
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'
),

-- DataViz Analytics Contacts
(
  '550e8400-e29b-41d4-a716-446655440501',
  '550e8400-e29b-41d4-a716-446655440005',
  'Alex',
  'Johnson',
  'alex@dataviz.example.com',
  '+1-555-0501',
  'Founder',
  'Executive',
  'new',
  TRUE,
  TRUE,
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'
);


-- ============================================================================
-- WEBSITES
-- ============================================================================

INSERT INTO websites (
  id, company_id, url, domain_name, status, is_primary,
  has_ssl, is_mobile_friendly, page_speed_score, seo_score,
  has_contact_form, has_whatsapp_widget, has_booking_system,
  created_by
) VALUES

-- TechFlow Solutions Website
(
  '550e8400-e29b-41d4-a716-446655440601',
  '550e8400-e29b-41d4-a716-446655440001',
  'https://techflow.example.com',
  'techflow.example.com',
  'pending_audit',
  TRUE,
  TRUE,
  TRUE,
  75,
  68,
  TRUE,
  FALSE,
  FALSE,
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'
),

-- Digital Rise Marketing Website
(
  '550e8400-e29b-41d4-a716-446655440602',
  '550e8400-e29b-41d4-a716-446655440002',
  'https://digitalrise.example.com',
  'digitalrise.example.com',
  'pending_audit',
  TRUE,
  TRUE,
  TRUE,
  82,
  75,
  TRUE,
  TRUE,
  FALSE,
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'
),

-- ShopHub Inc Website
(
  '550e8400-e29b-41d4-a716-446655440603',
  '550e8400-e29b-41d4-a716-446655440003',
  'https://shophub.example.com',
  'shophub.example.com',
  'pending_audit',
  TRUE,
  TRUE,
  TRUE,
  88,
  80,
  TRUE,
  FALSE,
  TRUE,
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'
),

-- Strategy Partners Website
(
  '550e8400-e29b-41d4-a716-446655440604',
  '550e8400-e29b-41d4-a716-446655440004',
  'https://strategypartners.example.com',
  'strategypartners.example.com',
  'pending_audit',
  TRUE,
  TRUE,
  FALSE,
  62,
  55,
  TRUE,
  FALSE,
  FALSE,
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'
),

-- DataViz Analytics Website
(
  '550e8400-e29b-41d4-a716-446655440605',
  '550e8400-e29b-41d4-a716-446655440005',
  'https://dataviz.example.com',
  'dataviz.example.com',
  'pending_audit',
  TRUE,
  TRUE,
  TRUE,
  91,
  85,
  TRUE,
  FALSE,
  FALSE,
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'
);


-- ============================================================================
-- CAMPAIGNS
-- ============================================================================

INSERT INTO campaigns (
  id, company_id, name, description, campaign_type, status, 
  target_count, sent_count, created_by
) VALUES

-- Email Campaign 1
(
  '550e8400-e29b-41d4-a716-446655440701',
  '550e8400-e29b-41d4-a716-446655440002',
  'Q2 2026 Outreach Campaign',
  'Outreach to mid-market tech companies',
  'cold_email',
  'draft',
  50,
  0,
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'
),

-- Proposal Campaign
(
  '550e8400-e29b-41d4-a716-446655440702',
  '550e8400-e29b-41d4-a716-446655440002',
  'Website Development Proposals',
  'Send website development proposals',
  'proposal',
  'draft',
  25,
  0,
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'
),

-- Follow-up Campaign
(
  '550e8400-e29b-41d4-a716-446655440703',
  '550e8400-e29b-41d4-a716-446655440002',
  'First Follow-up Series',
  'Follow up with non-responders',
  'follow_up',
  'draft',
  30,
  0,
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'
);


-- ============================================================================
-- MESSAGES
-- ============================================================================

INSERT INTO messages (
  id, campaign_id, contact_id, company_id, message_type, status,
  subject, body, to_address, from_address, created_by
) VALUES

-- Draft Emails for Campaign 1
(
  '550e8400-e29b-41d4-a716-446655440801',
  '550e8400-e29b-41d4-a716-446655440701',
  '550e8400-e29b-41d4-a716-446655440101',
  '550e8400-e29b-41d4-a716-446655440001',
  'email',
  'draft',
  'Improve Your Cloud Infrastructure',
  'Hi John,

We help tech companies optimize their cloud infrastructure and reduce costs.

Our services include:
- Infrastructure optimization
- DevOps consulting
- Cost reduction strategies

Would you be interested in a quick call?

Best regards',
  'john.anderson@techflow.example.com',
  'hello@digitalrise.example.com',
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'
),

(
  '550e8400-e29b-41d4-a716-446655440802',
  '550e8400-e29b-41d4-a716-446655440701',
  '550e8400-e29b-41d4-a716-446655440102',
  '550e8400-e29b-41d4-a716-446655440001',
  'email',
  'draft',
  'Operations Excellence Solutions',
  'Hi Sarah,

We specialize in helping operations teams streamline processes and improve efficiency.

Let''s schedule a brief conversation.

Best regards',
  'sarah.chen@techflow.example.com',
  'hello@digitalrise.example.com',
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'
);


-- ============================================================================
-- ACTIVITIES
-- ============================================================================

INSERT INTO activities (
  id, company_id, contact_id, activity_type, description, created_by
) VALUES

-- Company Created Activity
(
  '550e8400-e29b-41d4-a716-446655440901',
  '550e8400-e29b-41d4-a716-446655440001',
  NULL,
  'note_added',
  'Company imported from lead discovery',
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'
),

-- Contact Activity
(
  '550e8400-e29b-41d4-a716-446655440902',
  '550e8400-e29b-41d4-a716-446655440001',
  '550e8400-e29b-41d4-a716-446655440101',
  'contact_enriched',
  'Contact information verified and enriched',
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'
),

-- Website Crawl Activity
(
  '550e8400-e29b-41d4-a716-446655440903',
  '550e8400-e29b-41d4-a716-446655440001',
  NULL,
  'website_crawled',
  'Website crawled for content extraction',
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'
),

-- Lead Scored Activity
(
  '550e8400-e29b-41d4-a716-446655440904',
  '550e8400-e29b-41d4-a716-446655440001',
  NULL,
  'lead_scored',
  'Lead quality score calculated',
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'
);


-- ============================================================================
-- SUMMARY STATISTICS
-- ============================================================================

SELECT COUNT(*) as companies_count FROM companies;
SELECT COUNT(*) as contacts_count FROM contacts;
SELECT COUNT(*) as websites_count FROM websites;
SELECT COUNT(*) as campaigns_count FROM campaigns;
SELECT COUNT(*) as messages_count FROM messages;
SELECT COUNT(*) as activities_count FROM activities;
