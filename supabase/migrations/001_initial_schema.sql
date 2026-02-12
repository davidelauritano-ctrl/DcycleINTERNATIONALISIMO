-- ============================================================
-- Dcycle International Paid Media Tracker - Database Schema
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Table: campaign_names (INPUT Campaign Names)
-- ============================================================
CREATE TABLE IF NOT EXISTS campaign_names (
  id SERIAL PRIMARY KEY,
  original_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  country_code TEXT NOT NULL,
  nomenclature TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_names_original
  ON campaign_names (original_name);

-- ============================================================
-- Table: contacts (INPUT IMPORT MATRIX CONTACTS)
-- ============================================================
CREATE TABLE IF NOT EXISTS contacts (
  id SERIAL PRIMARY KEY,
  hubspot_record_id BIGINT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  first_email_date TIMESTAMPTZ,
  contact_owner TEXT,
  company_name TEXT,
  company_industry TEXT,
  lead_status TEXT,
  num_employees INTEGER,
  linkedin_company_url TEXT,
  lead_source TEXT,
  lead_origin_multiple TEXT,
  original_traffic_source TEXT,
  recent_deal_amount DECIMAL(12,2),
  meeting_date TIMESTAMPTZ,
  utm_campaign TEXT,
  associated_company_id BIGINT,
  upload_batch_id UUID,
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts (company_name);
CREATE INDEX IF NOT EXISTS idx_contacts_traffic_source ON contacts (original_traffic_source);
CREATE INDEX IF NOT EXISTS idx_contacts_utm ON contacts (utm_campaign);
CREATE INDEX IF NOT EXISTS idx_contacts_batch ON contacts (upload_batch_id);

-- ============================================================
-- Table: deals (INPUT IMPORT MATRIX DEALS)
-- ============================================================
CREATE TABLE IF NOT EXISTS deals (
  id SERIAL PRIMARY KEY,
  hubspot_record_id BIGINT UNIQUE NOT NULL,
  deal_name TEXT NOT NULL,
  deal_stage TEXT,
  close_date TIMESTAMPTZ,
  deal_owner TEXT,
  amount DECIMAL(12,2) DEFAULT 0,
  amount_corrected DECIMAL(12,2),
  is_closed_won BOOLEAN DEFAULT false,
  is_closed_lost BOOLEAN DEFAULT false,
  lost_comments TEXT,
  associated_contact TEXT,
  associated_company TEXT,
  associated_contact_id BIGINT,
  associated_company_id BIGINT,
  upload_batch_id UUID,
  synced_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deals_company ON deals (associated_company);
CREATE INDEX IF NOT EXISTS idx_deals_batch ON deals (upload_batch_id);

-- ============================================================
-- Table: linkedin_ads_raw (INPUT LINKEDIN REPORT PASTE)
-- ============================================================
CREATE TABLE IF NOT EXISTS linkedin_ads_raw (
  id SERIAL PRIMARY KEY,
  start_date DATE NOT NULL,
  campaign_group_name TEXT,
  campaign_name TEXT NOT NULL,
  creative_name TEXT,
  campaign_objective TEXT,
  campaign_type TEXT,
  campaign_status TEXT,
  total_spent DECIMAL(14,2) DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  ctr DECIMAL(12,6) DEFAULT 0,
  leads INTEGER DEFAULT 0,
  cost_per_lead DECIMAL(14,2) DEFAULT 0,
  average_cpc DECIMAL(14,2) DEFAULT 0,
  average_cpm DECIMAL(14,2) DEFAULT 0,
  reach INTEGER DEFAULT 0,
  avg_frequency DECIMAL(12,3) DEFAULT 0,
  lead_form_completion_rate DECIMAL(12,4) DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  cost_per_conversion DECIMAL(14,2) DEFAULT 0,
  engagement_rate DECIMAL(12,5) DEFAULT 0,
  reactions INTEGER DEFAULT 0,
  total_social_actions INTEGER DEFAULT 0,
  clicks_to_landing_page INTEGER DEFAULT 0,
  sends INTEGER DEFAULT 0,
  open_rate DECIMAL(12,4) DEFAULT 0,
  sponsored_messaging_clicks INTEGER DEFAULT 0,
  cost_per_open DECIMAL(14,2) DEFAULT 0,
  upload_batch_id UUID,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_linkedin_ads_unique
  ON linkedin_ads_raw (start_date, campaign_name, COALESCE(creative_name, ''));

CREATE INDEX IF NOT EXISTS idx_linkedin_ads_campaign ON linkedin_ads_raw (campaign_name);
CREATE INDEX IF NOT EXISTS idx_linkedin_ads_batch ON linkedin_ads_raw (upload_batch_id);

-- ============================================================
-- Table: mql_to_sql
-- ============================================================
CREATE TABLE IF NOT EXISTS mql_to_sql (
  id SERIAL PRIMARY KEY,
  company_name TEXT NOT NULL,
  meeting_set TEXT DEFAULT 'NO',
  is_sql BOOLEAN DEFAULT false,
  contact_date TIMESTAMPTZ,
  date_key TEXT,
  channel_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mql_company ON mql_to_sql (company_name);

-- ============================================================
-- Table: monthly_spend
-- ============================================================
CREATE TABLE IF NOT EXISTS monthly_spend (
  id SERIAL PRIMARY KEY,
  month_key TEXT NOT NULL,
  channel TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  UNIQUE(month_key, channel)
);

-- ============================================================
-- Table: forecast_config
-- ============================================================
CREATE TABLE IF NOT EXISTS forecast_config (
  id SERIAL PRIMARY KEY,
  year INTEGER NOT NULL,
  channel TEXT NOT NULL,
  month INTEGER NOT NULL,
  budget_pct DECIMAL(5,4) DEFAULT 0,
  budget_amount DECIMAL(10,2) DEFAULT 0,
  total_annual_budget DECIMAL(12,2) DEFAULT 0,
  cpmql_historical DECIMAL(10,2) DEFAULT 0,
  mql_to_sql_pct DECIMAL(5,4) DEFAULT 0,
  avg_pipe_per_sql DECIMAL(12,2) DEFAULT 0,
  win_rate DECIMAL(5,4) DEFAULT 0,
  organic_sql_expected DECIMAL(5,2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_forecast_unique
  ON forecast_config (year, channel, month);

-- ============================================================
-- Materialized View: leads_enriched
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS leads_enriched AS
SELECT
  c.id,
  c.first_name,
  c.last_name,
  c.email,
  c.first_email_date,
  EXTRACT(WEEK FROM c.first_email_date)::INTEGER AS week_number,
  COALESCE(c.company_industry, '-') AS industry,
  c.lead_status,
  c.num_employees,
  CASE
    WHEN c.num_employees > 5500 THEN 'ENTERPRISE'
    WHEN c.num_employees > 1500 THEN 'TIER 1'
    WHEN c.num_employees > 500 THEN 'TIER 2'
    WHEN c.num_employees > 250 THEN 'TIER 3'
    ELSE 'TIER 4'
  END AS tier,
  COALESCE(
    NULLIF(TRIM(c.utm_campaign), ''),
    NULLIF(TRIM(c.lead_origin_multiple), ''),
    c.original_traffic_source
  ) AS campaign_raw,
  c.original_traffic_source AS channel,
  c.company_name,
  COALESCE(d.deal_amount_sum, 0)::DECIMAL(12,2) AS deal_amount,
  EXTRACT(MONTH FROM c.first_email_date)::INTEGER || '_' || EXTRACT(YEAR FROM c.first_email_date)::INTEGER AS month_key,
  EXTRACT(YEAR FROM c.first_email_date)::INTEGER AS year,
  COALESCE(cn.country_code, '-') AS country,
  COALESCE(cn.normalized_name, '-') AS campaign_name_normalized,
  COALESCE(ms.meeting_set, 'Not Found') AS first_meeting_set
FROM contacts c
LEFT JOIN (
  SELECT associated_company, SUM(COALESCE(amount_corrected, amount)) AS deal_amount_sum
  FROM deals
  GROUP BY associated_company
) d ON d.associated_company = c.company_name
LEFT JOIN campaign_names cn ON cn.original_name = COALESCE(
  NULLIF(TRIM(c.utm_campaign), ''),
  NULLIF(TRIM(c.lead_origin_multiple), ''),
  c.original_traffic_source
)
LEFT JOIN mql_to_sql ms ON ms.company_name = c.company_name;

CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_enriched_id ON leads_enriched (id);

-- ============================================================
-- Materialized View: linkedin_ads_performance
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS linkedin_ads_performance AS
SELECT
  lar.id,
  lar.campaign_name,
  lar.creative_name,
  cn.normalized_name AS campaign_name_ok,
  cn.country_code AS country,
  lar.total_spent,
  lar.impressions,
  lar.clicks,
  lar.ctr AS click_through_rate,
  lar.leads,
  lar.cost_per_lead,
  lar.average_cpc,
  lar.average_cpm,
  lar.reach,
  lar.avg_frequency,
  lar.lead_form_completion_rate,
  lar.conversions,
  lar.engagement_rate,
  lar.reactions,
  lar.total_social_actions,
  lar.start_date,
  EXTRACT(MONTH FROM lar.start_date)::INTEGER || '_' || EXTRACT(YEAR FROM lar.start_date)::INTEGER AS month_key
FROM linkedin_ads_raw lar
LEFT JOIN campaign_names cn ON cn.original_name = lar.campaign_name;

CREATE UNIQUE INDEX IF NOT EXISTS idx_linkedin_perf_id ON linkedin_ads_performance (id);

-- ============================================================
-- RLS Policies (basic - auth required for all operations)
-- ============================================================
ALTER TABLE campaign_names ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_ads_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE mql_to_sql ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_spend ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecast_config ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access
CREATE POLICY "Authenticated users can do everything" ON campaign_names
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can do everything" ON contacts
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can do everything" ON deals
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can do everything" ON linkedin_ads_raw
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can do everything" ON mql_to_sql
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can do everything" ON monthly_spend
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can do everything" ON forecast_config
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================
-- Function to refresh materialized views
-- ============================================================
CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY leads_enriched;
  REFRESH MATERIALIZED VIEW CONCURRENTLY linkedin_ads_performance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
