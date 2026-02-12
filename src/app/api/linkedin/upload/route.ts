import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { v4 as uuidv4 } from "uuid";
import { getServiceSupabase } from "@/lib/supabase";

function parseNum(val: string | undefined | null): number {
  if (val === undefined || val === null || val === "") return 0;
  const cleaned = String(val).replace(/[^0-9.\-]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

function parseDate(val: string | undefined | null): string | null {
  if (!val) return null;
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split("T")[0];
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const csvText = await file.text();
    const parsed = Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: true,
    });

    if (parsed.errors.length > 0 && parsed.data.length === 0) {
      return NextResponse.json(
        { error: "CSV parse error", details: parsed.errors },
        { status: 400 }
      );
    }

    const batch_id = uuidv4();
    const supabase = getServiceSupabase();

    const rows = parsed.data.map((row) => ({
      start_date: parseDate(row["Start Date (in UTC)"]),
      campaign_group_name: row["Campaign Group Name"] ?? null,
      campaign_name: row["Campaign Name"] ?? "",
      creative_name: row["Creative Name"] ?? null,
      campaign_objective: row["Campaign Objective Type"] ?? null,
      campaign_type: row["Campaign Type"] ?? null,
      campaign_status: row["Campaign Status"] ?? null,
      total_spent: parseNum(row["Total Spent"]),
      impressions: parseNum(row["Impressions"]),
      clicks: parseNum(row["Clicks"]),
      ctr: parseNum(row["Click Through Rate"]),
      leads: parseNum(row["Leads"] ?? row["Leads (Work Email)"]),
      cost_per_lead: parseNum(row["Cost per Lead"]),
      average_cpc: parseNum(row["Average CPC"]),
      average_cpm: parseNum(row["Average CPM"]),
      reach: parseNum(row["Reach"]),
      avg_frequency: parseNum(row["Average Frequency"]),
      lead_form_completion_rate: parseNum(row["Lead Form Completion Rate"]),
      conversions: parseNum(row["Conversions"]),
      cost_per_conversion: parseNum(row["Cost per Conversion"]),
      engagement_rate: parseNum(row["Engagement Rate"]),
      reactions: parseNum(row["Reactions"]),
      total_social_actions: parseNum(row["Total Social Actions"]),
      clicks_to_landing_page: parseNum(row["Clicks to Landing Page"]),
      sends: parseNum(row["Sends"]),
      open_rate: parseNum(row["Open Rate"]),
      sponsored_messaging_clicks: parseNum(row["Sponsored InMail Clicks"]),
      cost_per_open: parseNum(row["Cost per Open"]),
      upload_batch_id: batch_id,
    }));

    // Upsert in batches of 500 (falls back to delete+insert if unique constraint missing)
    const BATCH_SIZE = 500;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from("linkedin_ads_raw")
        .upsert(batch, {
          onConflict: "start_date,campaign_name,creative_name",
        });

      if (error) {
        // If unique constraint is missing, fall back to delete-then-insert
        if (error.message.includes("no unique or exclusion constraint")) {
          // Delete existing rows that match this batch's date+campaign combos
          for (const row of batch) {
            await supabase
              .from("linkedin_ads_raw")
              .delete()
              .eq("start_date", row.start_date)
              .eq("campaign_name", row.campaign_name)
              .eq("creative_name", row.creative_name ?? "");
          }
          const { error: insertErr } = await supabase
            .from("linkedin_ads_raw")
            .insert(batch);
          if (insertErr) {
            throw new Error(
              `LinkedIn ads insert error (batch ${i / BATCH_SIZE}): ${insertErr.message}`
            );
          }
        } else {
          throw new Error(
            `LinkedIn ads upsert error (batch ${i / BATCH_SIZE}): ${error.message}`
          );
        }
      }
    }

    // Refresh materialized views
    const { error: rpcError } = await supabase.rpc("refresh_materialized_views");
    if (rpcError) {
      console.error("Failed to refresh materialized views:", rpcError.message);
    }

    return NextResponse.json({
      rows_processed: rows.length,
      batch_id,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("LinkedIn upload error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
