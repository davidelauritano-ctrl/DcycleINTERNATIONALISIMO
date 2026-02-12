import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

const ALLOWED_ENTITIES = [
  "leads_enriched",
  "linkedin_ads_performance",
  "contacts",
  "deals",
  "campaign_names",
  "mql_to_sql",
  "monthly_spend",
  "forecast_config",
] as const;

type Entity = (typeof ALLOWED_ENTITIES)[number];

/** Safe fetch: returns [] on any error (missing table, missing columns, etc.) */
async function safeFetch(
  supabase: SupabaseClient,
  table: string,
  columns = "*"
): Promise<Record<string, unknown>[]> {
  const { data, error } = await supabase.from(table).select(columns);
  if (error) {
    console.warn(`safeFetch(${table}): ${error.message}`);
    return [];
  }
  return (data as unknown as Record<string, unknown>[]) ?? [];
}

function getWeekNumber(dateStr: string): number | null {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const start = new Date(d.getFullYear(), 0, 1);
  const diff = d.getTime() - start.getTime();
  return Math.ceil((diff / 86400000 + start.getDay() + 1) / 7);
}

function getTier(employees: number | null): string {
  if (!employees) return "TIER 4";
  if (employees > 5500) return "ENTERPRISE";
  if (employees > 1500) return "TIER 1";
  if (employees > 500) return "TIER 2";
  if (employees > 250) return "TIER 3";
  return "TIER 4";
}

/**
 * Compute leads_enriched from raw contacts + deals + campaign_names + mql_to_sql.
 * Always computed in JS — never relies on the materialized view.
 */
async function computeLeadsEnriched(supabase: SupabaseClient) {
  const [contacts, deals, campaignNames, mqlToSql] = await Promise.all([
    safeFetch(supabase, "contacts"),
    safeFetch(supabase, "deals"),
    safeFetch(supabase, "campaign_names"),
    safeFetch(supabase, "mql_to_sql"),
  ]);

  // Aggregate deals by associated_company
  const dealMap = new Map<string, number>();
  for (const d of deals) {
    const company = (d.associated_company as string) ?? null;
    if (!company) continue;
    const amount = Number(d.amount_corrected ?? d.amount ?? 0);
    dealMap.set(company, (dealMap.get(company) || 0) + amount);
  }

  // Index campaign_names by original_name
  const cnMap = new Map<string, { country_code: string; normalized_name: string }>();
  for (const cn of campaignNames) {
    if (cn.original_name) {
      cnMap.set(cn.original_name as string, {
        country_code: (cn.country_code as string) ?? "-",
        normalized_name: (cn.normalized_name as string) ?? "-",
      });
    }
  }

  // Index mql_to_sql by company_name
  const msMap = new Map<string, string>();
  for (const ms of mqlToSql) {
    if (ms.company_name) {
      msMap.set(ms.company_name as string, (ms.meeting_set as string) ?? "Not Found");
    }
  }

  return contacts.map((c) => {
    const campaignRaw =
      (c.utm_campaign && String(c.utm_campaign).trim()) ||
      (c.lead_origin_multiple && String(c.lead_origin_multiple).trim()) ||
      (c.original_traffic_source ? String(c.original_traffic_source) : null) ||
      null;
    const cn = campaignRaw ? cnMap.get(String(campaignRaw)) : undefined;
    const companyName = c.company_name ? String(c.company_name) : null;
    const dealAmount = companyName ? dealMap.get(companyName) ?? 0 : 0;
    const meetingSet = companyName ? msMap.get(companyName) ?? "Not Found" : "Not Found";

    const fed = c.first_email_date ? String(c.first_email_date) : null;
    const fedDate = fed ? new Date(fed) : null;
    const month = fedDate && !isNaN(fedDate.getTime()) ? fedDate.getMonth() + 1 : null;
    const year = fedDate && !isNaN(fedDate.getTime()) ? fedDate.getFullYear() : null;
    const monthKey = month && year ? `${month}_${year}` : null;

    return {
      id: c.id,
      first_name: c.first_name ?? null,
      last_name: c.last_name ?? null,
      email: c.email ?? null,
      first_email_date: fed,
      week_number: fed ? getWeekNumber(fed) : null,
      industry: c.company_industry || "-",
      lead_status: c.lead_status ?? null,
      num_employees: c.num_employees ?? null,
      tier: getTier(c.num_employees as number | null),
      campaign_raw: campaignRaw,
      channel: c.original_traffic_source ?? null,
      company_name: companyName,
      deal_amount: dealAmount,
      month_key: monthKey,
      year,
      country: cn?.country_code || "-",
      campaign_name_normalized: cn?.normalized_name || "-",
      first_meeting_set: meetingSet,
    };
  });
}

/**
 * Compute linkedin_ads_performance from raw linkedin_ads_raw + campaign_names.
 */
async function computeLinkedinPerf(supabase: SupabaseClient) {
  const [rawRows, campaignNames] = await Promise.all([
    safeFetch(supabase, "linkedin_ads_raw"),
    safeFetch(supabase, "campaign_names"),
  ]);

  if (rawRows.length === 0) return [];

  const cnMap = new Map<string, { country_code: string; normalized_name: string }>();
  for (const cn of campaignNames) {
    if (cn.original_name) {
      cnMap.set(cn.original_name as string, {
        country_code: (cn.country_code as string) ?? null,
        normalized_name: (cn.normalized_name as string) ?? null,
      });
    }
  }

  return rawRows.map((r) => {
    const cn = r.campaign_name ? cnMap.get(String(r.campaign_name)) : undefined;
    const startDate = r.start_date ? String(r.start_date) : null;
    const sd = startDate ? new Date(startDate) : null;
    const month = sd && !isNaN(sd.getTime()) ? sd.getMonth() + 1 : null;
    const year = sd && !isNaN(sd.getTime()) ? sd.getFullYear() : null;

    return {
      id: r.id,
      campaign_name: r.campaign_name ?? null,
      creative_name: r.creative_name ?? null,
      campaign_name_ok: cn?.normalized_name ?? null,
      country: cn?.country_code ?? null,
      total_spent: Number(r.total_spent ?? 0),
      impressions: Number(r.impressions ?? 0),
      clicks: Number(r.clicks ?? 0),
      click_through_rate: Number(r.ctr ?? 0),
      leads: Number(r.leads ?? 0),
      cost_per_lead: Number(r.cost_per_lead ?? 0),
      average_cpc: Number(r.average_cpc ?? 0),
      average_cpm: Number(r.average_cpm ?? 0),
      reach: Number(r.reach ?? 0),
      avg_frequency: Number(r.avg_frequency ?? 0),
      lead_form_completion_rate: Number(r.lead_form_completion_rate ?? 0),
      conversions: Number(r.conversions ?? 0),
      engagement_rate: Number(r.engagement_rate ?? 0),
      reactions: Number(r.reactions ?? 0),
      total_social_actions: Number(r.total_social_actions ?? 0),
      start_date: startDate,
      month_key: month && year ? `${month}_${year}` : null,
    };
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entity = searchParams.get("entity") as Entity | null;

    if (!entity || !ALLOWED_ENTITIES.includes(entity)) {
      return NextResponse.json(
        {
          error: `Invalid entity. Allowed: ${ALLOWED_ENTITIES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();

    // Always compute leads_enriched from raw tables (view may not exist)
    if (entity === "leads_enriched") {
      const computed = await computeLeadsEnriched(supabase);
      return NextResponse.json(computed);
    }

    // Always compute linkedin_ads_performance from raw tables (view may not exist)
    if (entity === "linkedin_ads_performance") {
      const computed = await computeLinkedinPerf(supabase);
      return NextResponse.json(computed);
    }

    // Generic entity fetch
    const month_key = searchParams.get("month_key");
    const country = searchParams.get("country");
    const channel = searchParams.get("channel");

    let query = supabase.from(entity).select("*");

    if (month_key) query = query.eq("month_key", month_key);
    if (country) query = query.eq("country", country);
    if (channel) query = query.eq("channel", channel);

    const { data, error } = await query;

    if (error) {
      console.warn(`Data API: ${entity} query failed: ${error.message}`);
      return NextResponse.json([]);
    }

    return NextResponse.json(data ?? []);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Data API error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
