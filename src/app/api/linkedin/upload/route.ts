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

/** Parse and round to integer for INTEGER columns */
function parseInt_(val: string | undefined | null): number {
  return Math.round(parseNum(val));
}

/** Parse and round to fixed decimals for DECIMAL columns */
function parseDec(
  val: string | undefined | null,
  maxDigitsBefore: number,
  decimals: number,
): number {
  const n = parseNum(val);
  const rounded = Number(n.toFixed(decimals));
  const maxVal = Math.pow(10, maxDigitsBefore) - Math.pow(10, -decimals);
  if (rounded > maxVal) return maxVal;
  if (rounded < -maxVal) return -maxVal;
  return rounded;
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
      total_spent: parseDec(row["Total Spent"], 12, 2),
      impressions: parseInt_(row["Impressions"]),
      clicks: parseInt_(row["Clicks"]),
      ctr: parseDec(row["Click Through Rate"], 6, 6),
      leads: parseInt_(row["Leads"] ?? row["Leads (Work Email)"]),
      cost_per_lead: parseDec(row["Cost per Lead"], 12, 2),
      average_cpc: parseDec(row["Average CPC"], 12, 2),
      average_cpm: parseDec(row["Average CPM"], 12, 2),
      reach: parseInt_(row["Reach"]),
      avg_frequency: parseDec(row["Average Frequency"], 6, 3),
      lead_form_completion_rate: parseDec(row["Lead Form Completion Rate"], 6, 4),
      conversions: parseInt_(row["Conversions"]),
      cost_per_conversion: parseDec(row["Cost per Conversion"], 12, 2),
      engagement_rate: parseDec(row["Engagement Rate"], 6, 5),
      reactions: parseInt_(row["Reactions"]),
      total_social_actions: parseInt_(row["Total Social Actions"]),
      clicks_to_landing_page: parseInt_(row["Clicks to Landing Page"]),
      sends: parseInt_(row["Sends"]),
      open_rate: parseDec(row["Open Rate"], 6, 4),
      sponsored_messaging_clicks: parseInt_(row["Sponsored InMail Clicks"]),
      cost_per_open: parseDec(row["Cost per Open"], 12, 2),
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
