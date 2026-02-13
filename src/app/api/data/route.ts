import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

const ALLOWED_ENTITIES = [
  "leads_enriched",
  "linkedin_ads_performance",
  "contacts",
  "deals",
  "leads",
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
 * Normalize HubSpot original_traffic_source values to standard channel names.
 * HubSpot exports values like "PAID_SOCIAL", "PAID_SEARCH", "ORGANIC_SEARCH",
 * "SOCIAL_MEDIA", "DIRECT_TRAFFIC", "EMAIL_MARKETING", etc.
 * The dashboard expects "Paid Social", "Paid Search", "Organic Search", etc.
 */
function normalizeChannel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = String(raw).trim().toUpperCase().replace(/[\s_-]+/g, "_");
  switch (v) {
    case "PAID_SOCIAL":
    case "PAID_SOCIAL_MEDIA":
      return "Paid Social";
    case "PAID_SEARCH":
      return "Paid Search";
    case "ORGANIC_SEARCH":
      return "Organic Search";
    case "AI_REFERRALS":
    case "AI_REFERRAL":
      return "AI Referrals";
    case "REFERRAL_FROM_SPANISH_CLIENT":
      return "Referral From Spanish Client";
    case "REFERRAL_FROM_NETSUITE":
      return "Referral From NetSuite";
    case "SOCIAL_MEDIA":
      return "Paid Social";
    default: {
      // Try a direct match (user may have already-normalized values)
      const trimmed = String(raw).trim();
      const known = [
        "Paid Social", "Paid Search", "Organic Search",
        "AI Referrals", "Referral From Spanish Client", "Referral From NetSuite",
      ];
      for (const k of known) {
        if (trimmed.toLowerCase() === k.toLowerCase()) return k;
      }
      return trimmed || null;
    }
  }
}

/**
 * Compute leads_enriched from raw contacts + deals + campaign_names + mql_to_sql.
 * Always computed in JS — never relies on the materialized view.
 * When debug=true, returns { data, _debug } with join diagnostics.
 */
async function computeLeadsEnriched(supabase: SupabaseClient, debug = false) {
  const [contacts, deals, campaignNames, mqlToSql] = await Promise.all([
    safeFetch(supabase, "contacts"),
    safeFetch(supabase, "deals"),
    safeFetch(supabase, "campaign_names"),
    safeFetch(supabase, "mql_to_sql"),
  ]);

  // Build multiple deal-amount lookup maps for robust join.
  // Priority: contact ID → company ID → company name → contact name
  const dealByContactId = new Map<number, number>();       // deals.associated_contact_id → sum
  const dealByCompanyId = new Map<number, number>();       // deals.associated_company_id → sum
  const dealByCompanyName = new Map<string, number>();     // deals.associated_company (lower) → sum
  const dealByContactName = new Map<string, number>();     // deals.associated_contact (lower) → sum
  for (const d of deals) {
    const amount = Number(d.amount_corrected ?? d.amount ?? 0);
    if (amount === 0) continue;

    const contactId = d.associated_contact_id ? Number(d.associated_contact_id) : null;
    if (contactId) {
      dealByContactId.set(contactId, (dealByContactId.get(contactId) || 0) + amount);
    }

    const companyId = d.associated_company_id ? Number(d.associated_company_id) : null;
    if (companyId) {
      dealByCompanyId.set(companyId, (dealByCompanyId.get(companyId) || 0) + amount);
    }

    const companyName = d.associated_company ? String(d.associated_company).trim().toLowerCase() : null;
    if (companyName) {
      dealByCompanyName.set(companyName, (dealByCompanyName.get(companyName) || 0) + amount);
    }

    const contactName = d.associated_contact ? String(d.associated_contact).trim().toLowerCase() : null;
    if (contactName) {
      dealByContactName.set(contactName, (dealByContactName.get(contactName) || 0) + amount);
    }
  }

  // Index campaign_names by original_name (case-insensitive, trimmed for robust matching)
  const cnMap = new Map<string, { country_code: string; normalized_name: string }>();
  for (const cn of campaignNames) {
    if (cn.original_name) {
      const key = String(cn.original_name).trim().toLowerCase();
      cnMap.set(key, {
        country_code: (cn.country_code as string) ?? "-",
        normalized_name: (cn.normalized_name as string) ?? "-",
      });
    }
  }

  // Index mql_to_sql by company_name (case-insensitive, trimmed)
  const msMap = new Map<string, string>();
  for (const ms of mqlToSql) {
    if (ms.company_name) {
      const key = String(ms.company_name).trim().toLowerCase();
      msMap.set(key, (ms.meeting_set as string) ?? "Not Found");
    }
  }

  // Track join match counts for debug mode
  const matchCounts = { byContactId: 0, byCompanyId: 0, byCompanyName: 0, byContactName: 0, noMatch: 0 };

  const rows = contacts.map((c) => {
    const campaignRaw =
      (c.utm_campaign && String(c.utm_campaign).trim()) ||
      (c.lead_origin_multiple && String(c.lead_origin_multiple).trim()) ||
      (c.original_traffic_source ? String(c.original_traffic_source) : null) ||
      null;

    // Campaign name lookup: case-insensitive, trimmed
    const cnKey = campaignRaw ? String(campaignRaw).trim().toLowerCase() : null;
    const cn = cnKey ? cnMap.get(cnKey) : undefined;

    const companyName = c.company_name ? String(c.company_name) : null;
    const companyNameLower = companyName ? companyName.trim().toLowerCase() : null;

    // Deal amount: try all join paths — contact ID → company ID → company name → contact name
    const contactRecordId = c.hubspot_record_id ? Number(c.hubspot_record_id) : null;
    const contactCompanyId = c.associated_company_id ? Number(c.associated_company_id) : null;
    const fullName = [c.first_name, c.last_name].filter(Boolean).join(" ").trim().toLowerCase() || null;
    let dealAmount = 0;
    if (contactRecordId && dealByContactId.has(contactRecordId)) {
      dealAmount = dealByContactId.get(contactRecordId)!;
      matchCounts.byContactId++;
    } else if (contactCompanyId && dealByCompanyId.has(contactCompanyId)) {
      dealAmount = dealByCompanyId.get(contactCompanyId)!;
      matchCounts.byCompanyId++;
    } else if (companyNameLower && dealByCompanyName.has(companyNameLower)) {
      dealAmount = dealByCompanyName.get(companyNameLower)!;
      matchCounts.byCompanyName++;
    } else if (fullName && dealByContactName.has(fullName)) {
      dealAmount = dealByContactName.get(fullName)!;
      matchCounts.byContactName++;
    } else {
      matchCounts.noMatch++;
    }

    // MQL-to-SQL meeting set: case-insensitive company name lookup
    const meetingSet = companyNameLower ? msMap.get(companyNameLower) ?? "Not Found" : "Not Found";

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
      channel: normalizeChannel(c.original_traffic_source as string | null),
      company_name: companyName,
      deal_amount: dealAmount,
      month_key: monthKey,
      year,
      country: cn?.country_code || "-",
      campaign_name_normalized: cn?.normalized_name || "-",
      first_meeting_set: meetingSet,
    };
  });

  if (debug) {
    // Sample data for diagnosing join issues
    const sampleDeal = deals[0] ?? {};
    const sampleContact = contacts[0] ?? {};
    return {
      data: rows,
      _debug: {
        total_contacts: contacts.length,
        total_deals: deals.length,
        deals_with_amount: deals.filter(d => Number(d.amount_corrected ?? d.amount ?? 0) > 0).length,
        deal_columns_present: deals.length > 0 ? Object.keys(sampleDeal) : [],
        contact_columns_present: contacts.length > 0 ? Object.keys(sampleContact) : [],
        deal_maps: {
          byContactId_entries: dealByContactId.size,
          byCompanyId_entries: dealByCompanyId.size,
          byCompanyName_entries: dealByCompanyName.size,
          byCompanyName_sample: Array.from(dealByCompanyName.keys()).slice(0, 5),
          byContactName_entries: dealByContactName.size,
          byContactName_sample: Array.from(dealByContactName.keys()).slice(0, 5),
        },
        contact_fields: {
          with_hubspot_record_id: contacts.filter(c => c.hubspot_record_id).length,
          with_associated_company_id: contacts.filter(c => c.associated_company_id).length,
          with_company_name: contacts.filter(c => c.company_name).length,
          company_name_sample: contacts.slice(0, 5).map(c => c.company_name ?? "(null)"),
        },
        match_counts: matchCounts,
        total_pipeline: rows.reduce((s, r) => s + r.deal_amount, 0),
      },
    };
  }

  return rows;
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
      const key = String(cn.original_name).trim().toLowerCase();
      cnMap.set(key, {
        country_code: (cn.country_code as string) ?? null,
        normalized_name: (cn.normalized_name as string) ?? null,
      });
    }
  }

  return rawRows.map((r) => {
    const cnKey = r.campaign_name ? String(r.campaign_name).trim().toLowerCase() : null;
    const cn = cnKey ? cnMap.get(cnKey) : undefined;
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
      const debugMode = searchParams.get("debug") === "true";

      // Prefer unified leads table ONLY if it has rows uploaded via our route
      // (upload_batch_id is not null). This avoids using pre-existing leads
      // data that has a different schema.
      const { data: directLeads, error: leadsErr } = await supabase
        .from("leads")
        .select("*")
        .not("upload_batch_id", "is", null);

      if (!leadsErr && directLeads && directLeads.length > 0) {
        // Map the leads table rows to the LeadEnriched shape
        const rows = directLeads.map((r: Record<string, unknown>) => ({
          id: r.id,
          first_name: r.first_name ?? null,
          last_name: r.last_name ?? null,
          email: r.email ?? null,
          first_email_date: r.first_email_date ?? null,
          week_number: r.week_number ?? null,
          industry: r.industry ?? "-",
          lead_status: r.lead_status ?? null,
          num_employees: r.num_employees ?? null,
          tier: r.tier ?? "TIER 4",
          campaign_raw: r.campaign_raw ?? null,
          channel: r.channel ?? null,
          company_name: r.company_name ?? null,
          deal_amount: Number(r.deal_amount ?? 0),
          month_key: r.month_key ?? null,
          year: r.year ?? null,
          country: r.country ?? "-",
          campaign_name_normalized: r.campaign_name_normalized ?? "-",
          first_meeting_set: r.first_meeting_set ?? "Not Found",
        }));

        if (debugMode) {
          return NextResponse.json({
            data: rows,
            _debug: {
              source: "leads_table_direct",
              total_rows: rows.length,
              rows_with_deal: rows.filter((r) => r.deal_amount > 0).length,
              total_pipeline: rows.reduce((s, r) => s + r.deal_amount, 0),
              sample_row: rows[0] ?? null,
            },
          });
        }

        return NextResponse.json(rows);
      }

      // Fallback: compute from contacts + deals (legacy two-CSV approach)
      const computed = await computeLeadsEnriched(supabase, debugMode);
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
