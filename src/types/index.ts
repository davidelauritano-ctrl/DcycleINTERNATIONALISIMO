// ============================================================
// Database row types
// ============================================================

export interface CampaignName {
  id: number;
  original_name: string;
  normalized_name: string;
  country_code: string;
  nomenclature: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Contact {
  id: number;
  hubspot_record_id: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  first_email_date: string | null;
  contact_owner: string | null;
  company_name: string | null;
  company_industry: string | null;
  lead_status: string | null;
  num_employees: number | null;
  linkedin_company_url: string | null;
  lead_source: string | null;
  lead_origin_multiple: string | null;
  original_traffic_source: string | null;
  recent_deal_amount: number | null;
  meeting_date: string | null;
  utm_campaign: string | null;
  associated_company_id: number | null;
  synced_at: string;
  created_at: string;
}

export interface Deal {
  id: number;
  hubspot_record_id: number;
  deal_name: string;
  deal_stage: string | null;
  close_date: string | null;
  deal_owner: string | null;
  amount: number;
  amount_corrected: number | null;
  is_closed_won: boolean;
  is_closed_lost: boolean;
  lost_comments: string | null;
  associated_contact: string | null;
  associated_company: string | null;
  associated_contact_id: number | null;
  associated_company_id: number | null;
  synced_at: string;
}

export interface LinkedInAdsRaw {
  id: number;
  start_date: string;
  campaign_group_name: string | null;
  campaign_name: string;
  creative_name: string | null;
  campaign_objective: string | null;
  campaign_type: string | null;
  campaign_status: string | null;
  total_spent: number;
  impressions: number;
  clicks: number;
  ctr: number;
  leads: number;
  cost_per_lead: number;
  average_cpc: number;
  average_cpm: number;
  reach: number;
  avg_frequency: number;
  lead_form_completion_rate: number;
  conversions: number;
  cost_per_conversion: number;
  engagement_rate: number;
  reactions: number;
  total_social_actions: number;
  clicks_to_landing_page: number;
  sends: number;
  open_rate: number;
  sponsored_messaging_clicks: number;
  cost_per_open: number;
  upload_batch_id: string | null;
  uploaded_at: string;
}

export interface MqlToSql {
  id: number;
  company_name: string;
  meeting_set: string;
  is_sql: boolean;
  contact_date: string | null;
  date_key: string | null;
  channel_type: string | null;
  created_at: string;
}

export interface MonthlySpend {
  id: number;
  month_key: string;
  channel: string;
  amount: number;
}

export interface ForecastConfig {
  id: number;
  year: number;
  channel: string;
  month: number;
  budget_pct: number;
  budget_amount: number;
  total_annual_budget: number;
  cpmql_historical: number;
  mql_to_sql_pct: number;
  avg_pipe_per_sql: number;
  win_rate: number;
  organic_sql_expected: number;
  updated_at: string;
}

// ============================================================
// Materialized view types
// ============================================================

export interface LeadEnriched {
  id: number;
  first_name: string | null;
  last_name: string | null;
  first_email_date: string | null;
  week_number: number | null;
  industry: string;
  lead_status: string | null;
  tier: string;
  campaign_raw: string | null;
  channel: string | null;
  company_name: string | null;
  deal_amount: number;
  month_key: string | null;
  year: number | null;
  country: string;
  campaign_name_normalized: string;
  first_meeting_set: string;
  num_employees: number | null;
  email: string | null;
}

export interface LinkedInAdsPerformance {
  id: number;
  campaign_name: string;
  creative_name: string | null;
  campaign_name_ok: string | null;
  country: string | null;
  total_spent: number;
  impressions: number;
  clicks: number;
  click_through_rate: number;
  leads: number;
  cost_per_lead: number;
  average_cpc: number;
  average_cpm: number;
  reach: number;
  avg_frequency: number;
  lead_form_completion_rate: number;
  conversions: number;
  engagement_rate: number;
  reactions: number;
  total_social_actions: number;
  start_date: string;
  month_key: string;
}

// ============================================================
// Dashboard / aggregated types
// ============================================================

export interface ChannelMonthlyMetrics {
  month_key: string;
  channel: string;
  leads: number;
  mqls: number;
  sqls: number;
  pipeline: number;
  spend: number;
  cpl: number;
  cpmql: number;
  cpsql: number;
}

export interface CountryMonthlyMetrics {
  month_key: string;
  country: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  leads: number;
  mqls: number;
  sqls: number;
  pipeline: number;
  cpl: number;
  cpmql: number;
  cpsql: number;
  cpc: number;
  cpm: number;
  first_meeting_set: number;
}

export interface CampaignMonthlyMetrics {
  month_key: string;
  campaign_name_normalized: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  leads: number;
  mqls: number;
  sqls: number;
  pipeline: number;
  cpl: number;
  cpmql: number;
  cpsql: number;
}

export interface ForecastRow {
  month: number;
  month_name: string;
  channel: string;
  budget: number;
  budget_pct: number;
  expected_mqls: number;
  expected_sqls: number;
  pipeline_forecast: number;
  pipeline_cumulative: number;
}

export type Country = 'UK' | 'USA' | 'Netherlands' | 'Germany' | 'Chile' | 'EAU' | 'Sweden' | 'Switzerland' | 'Poland' | 'Spain' | 'Multi';

export const COUNTRIES: Country[] = ['UK', 'USA', 'Netherlands', 'Germany', 'Chile', 'EAU', 'Sweden', 'Switzerland', 'Poland', 'Spain', 'Multi'];

export const TIER_LABELS = ['ENTERPRISE', 'TIER 1', 'TIER 2', 'TIER 3', 'TIER 4'] as const;
export type Tier = (typeof TIER_LABELS)[number];

export const LEAD_STATUSES = [
  'MQL',
  'Not Qualified',
  'In sequence',
  'Open deal',
  'Closed Won',
  'Closed Lost',
  'SQL',
] as const;

export const CHANNELS = [
  'Paid Social',
  'Paid Search',
  'Organic Search',
  'AI Referrals',
  'Referral From Spanish Client',
  'Referral From NetSuite',
] as const;

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;
