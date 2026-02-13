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

function parseDatetime(val: string | undefined | null): string | null {
  if (!val || val.trim() === "") return null;
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

function parseBigInt(val: string | undefined | null): number | null {
  if (!val || val.trim() === "") return null;
  const cleaned = String(val).replace(/[^0-9\-]/g, "");
  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) ? null : parsed;
}

function parseBool(val: string | undefined | null): boolean {
  if (!val) return false;
  const v = val.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "si" || v === "sì";
}

function str(val: string | undefined | null): string | null {
  if (!val || val.trim() === "") return null;
  return val.trim();
}

/** Case-insensitive column lookup across multiple possible header names */
function col(row: Record<string, string>, ...names: string[]): string | undefined {
  // Exact match first (fast path)
  for (const name of names) {
    if (name in row && row[name] !== "") return row[name];
  }
  // Case-insensitive fallback
  const entries = Object.entries(row);
  for (const name of names) {
    const lower = name.toLowerCase();
    for (const [k, v] of entries) {
      if (k.trim().toLowerCase() === lower && v !== "") return v;
    }
  }
  return undefined;
}

function mapRow(row: Record<string, string>, batchId: string): Record<string, unknown> {
  return {
    hubspot_record_id: parseBigInt(col(row, "Record ID", "RecordID", "HubSpot Record ID")),
    deal_name: str(col(row, "Deal Name", "DealName")) ?? "",
    deal_stage: str(col(row, "Deal Stage", "DealStage")),
    close_date: parseDatetime(col(row, "Close Date", "Close date", "CloseDate")),
    deal_owner: str(col(row, "Deal owner", "Deal Owner", "DealOwner")),
    amount: parseNum(col(row, "Amount", "Deal Amount", "DealAmount")),
    amount_corrected: col(row, "Amount Corrected", "Deal Amount Corrected")
      ? parseNum(col(row, "Amount Corrected", "Deal Amount Corrected"))
      : null,
    is_closed_won: parseBool(col(row, "Is Closed Won", "Closed Won")),
    is_closed_lost: parseBool(col(row, "Is Closed Lost", "Closed Lost")),
    lost_comments: str(
      col(row, "Lost Comments", "Closed Lost Reason", "lost_comments"),
    ),
    associated_contact: str(
      col(row, "Associated Contact", "Associated Contacts", "Contact Name"),
    ),
    associated_company: str(
      col(row, "Associated Company", "Associated Companies", "Company Name", "Company"),
    ),
    associated_contact_id: parseBigInt(
      col(row, "Associated Contact ID", "Associated Contact IDs"),
    ),
    associated_company_id: parseBigInt(
      col(row, "Associated Company ID", "Associated Company IDs"),
    ),
    upload_batch_id: batchId,
    synced_at: new Date().toISOString(),
  };
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
      transformHeader: (h) => h.trim().replace(/^\uFEFF/, ""),
    });

    if (parsed.errors.length > 0 && parsed.data.length === 0) {
      return NextResponse.json(
        { error: "CSV parse error", details: parsed.errors },
        { status: 400 },
      );
    }

    if (parsed.data.length === 0) {
      return NextResponse.json(
        { error: "No rows found in CSV." },
        { status: 400 },
      );
    }

    // Log detected CSV headers for debugging
    const csvHeaders = Object.keys(parsed.data[0]);
    console.log("Deals CSV headers:", csvHeaders);

    const batch_id = uuidv4();
    const supabase = getServiceSupabase();

    // --- Phase 1: Discover valid columns using a single test row ---
    const badCols = new Set<string>();
    const testRow = mapRow(parsed.data[0], batch_id);

    function clean(row: Record<string, unknown>): Record<string, unknown> {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        if (!badCols.has(k)) out[k] = v;
      }
      return out;
    }

    let testError: { message: string } | null | undefined = null;
    for (let attempt = 0; attempt < 20; attempt++) {
      const cleaned = clean(testRow);
      const { error } = await supabase.from("deals").upsert([cleaned], { onConflict: "hubspot_record_id" });
      testError = error;

      if (!error) break; // success — we know the valid columns

      const match = error.message.match(/Could not find the '(\w+)' column/);
      if (match) {
        badCols.add(match[1]);
        continue;
      }
      // Some other error (not a missing column) — break and report
      break;
    }

    if (testError) {
      throw new Error(`Deals insert error (test row): ${testError.message}`);
    }

    if (badCols.size > 0) {
      console.warn("Deals upload: DB columns not found (skipped):", Array.from(badCols));
    }

    // Test row upserted successfully as row #1.
    // Now upsert the remaining rows in batches.
    const remaining = parsed.data.slice(1);

    const BATCH_SIZE = 500;
    for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
      const batch = remaining
        .slice(i, i + BATCH_SIZE)
        .map((row) => clean(mapRow(row, batch_id)));

      const { error } = await supabase.from("deals").upsert(batch, { onConflict: "hubspot_record_id" });

      if (error) {
        throw new Error(
          `Deals insert error (batch ${Math.floor(i / BATCH_SIZE) + 1}): ${error.message}`,
        );
      }
    }

    return NextResponse.json({
      rows_processed: parsed.data.length,
      batch_id,
      csv_headers: csvHeaders,
      columns_skipped: badCols.size > 0 ? Array.from(badCols) : undefined,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Deals upload error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
