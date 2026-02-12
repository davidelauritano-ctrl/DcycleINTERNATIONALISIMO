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
 * Used as fallback when the materialized view doesn't exist.
 */
async function computeLeadsEnriched(supabase: SupabaseClient) {
  // Fetch raw tables in parallel; ignore errors on optional tables
  const [contactsRes, dealsRes, cnRes, msRes] = await Promise.all([
    supabase.from("contacts").select("*"),
    supabase.from("deals").select("associated_company,amount,amount_corrected"),
    supabase.from("campaign_names").select("original_name,country_code,normalized_name"),
    supabase.from("mql_to_sql").select("company_name,meeting_set"),
  ]);

  const contacts = contactsRes.data ?? [];
  const deals = dealsRes.data ?? [];
  const campaignNames = cnRes.data ?? [];
  const mqlToSql = msRes.data ?? [];

  // Aggregate deals by associated_company
  const dealMap = new Map<string, number>();
  for (const d of deals) {
    const company = d.associated_company;
    if (!company) continue;
    const amount = d.amount_corrected ?? d.amount ?? 0;
    dealMap.set(company, (dealMap.get(company) || 0) + Number(amount));
  }

  // Index campaign_names by original_name
  const cnMap = new Map<string, { country_code: string; normalized_name: string }>();
  for (const cn of campaignNames) {
    if (cn.original_name) cnMap.set(cn.original_name, cn);
  }

  // Index mql_to_sql by company_name
  const msMap = new Map<string, string>();
  for (const ms of mqlToSql) {
    if (ms.company_name) msMap.set(ms.company_name, ms.meeting_set);
  }

  return contacts.map((c: Record<string, unknown>) => {
    const campaignRaw =
      (c.utm_campaign && String(c.utm_campaign).trim()) ||
      (c.lead_origin_multiple && String(c.lead_origin_multiple).trim()) ||
      (c.original_traffic_source as string | null) ||
      null;
    const cn = campaignRaw ? cnMap.get(String(campaignRaw)) : undefined;
    const dealAmount = c.company_name ? dealMap.get(c.company_name as string) ?? 0 : 0;
    const meetingSet = c.company_name ? msMap.get(c.company_name as string) ?? "Not Found" : "Not Found";

    const fed = c.first_email_date as string | null;
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
      company_name: c.company_name ?? null,
      deal_amount: dealAmount,
      month_key: monthKey,
      year,
      country: cn?.country_code || "-",
      campaign_name_normalized: cn?.normalized_name || "-",
      first_meeting_set: meetingSet,
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

    // Special handling for leads_enriched: try the view, fall back to computing from raw tables
    if (entity === "leads_enriched") {
      const { data, error } = await supabase.from("leads_enriched").select("*");

      if (error?.message?.includes("does not exist")) {
        const computed = await computeLeadsEnriched(supabase);
        return NextResponse.json(computed);
      }

      if (error) {
        throw new Error(`Supabase query error on leads_enriched: ${error.message}`);
      }

      return NextResponse.json(data ?? []);
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
      // If a table doesn't exist, return empty array instead of crashing
      if (error.message?.includes("does not exist")) {
        return NextResponse.json([]);
      }
      throw new Error(`Supabase query error on ${entity}: ${error.message}`);
    }

    return NextResponse.json(data ?? []);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Data API error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
