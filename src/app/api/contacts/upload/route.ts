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
    first_name: str(col(row, "First Name", "FirstName")),
    last_name: str(col(row, "Last Name", "LastName")),
    email: str(col(row, "Email", "Email Address")),
    phone: str(col(row, "Phone Number", "Phone")),
    first_email_date: parseDatetime(col(row, "First Email Date")),
    contact_owner: str(col(row, "Contact owner", "Contact Owner")),
    company_name: str(col(row, "Company Name", "Company", "Associated Company", "Associated Companies")),
    company_industry: str(col(row, "Industry", "Company Industry")),
    lead_status: str(col(row, "Lead Status")),
    num_employees: col(row, "Number of Employees", "Employees")
      ? Math.round(parseNum(col(row, "Number of Employees", "Employees")))
      : null,
    linkedin_company_url: str(
      col(row, "LinkedIn Company Page", "LinkedIn Company URL"),
    ),
    lead_source: str(col(row, "Lead Source")),
    lead_origin_multiple: str(
      col(row, "Lead Origin (multiple)", "Lead Origin"),
    ),
    original_traffic_source: str(
      col(row, "Original Source", "Original Traffic Source"),
    ),
    recent_deal_amount: col(row, "Recent Deal Amount")
      ? parseNum(col(row, "Recent Deal Amount"))
      : null,
    meeting_date: parseDatetime(col(row, "Meeting Date")),
    utm_campaign: str(col(row, "UTM Campaign", "utm_campaign")),
    associated_company_id: parseBigInt(col(row, "Associated Company ID", "Associated Company IDs")),
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
    console.log("Contacts CSV headers:", csvHeaders);

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
      const { error } = await supabase.from("contacts").upsert([cleaned], { onConflict: "hubspot_record_id" });
      testError = error;

      if (!error) break;

      const match = error.message.match(/Could not find the '(\w+)' column/);
      if (match) {
        badCols.add(match[1]);
        continue;
      }
      break;
    }

    if (testError) {
      throw new Error(`Contacts insert error (test row): ${testError.message}`);
    }

    if (badCols.size > 0) {
      console.warn("Contacts upload: DB columns not found (skipped):", Array.from(badCols));
    }

    // Test row upserted. Now upsert the rest in batches.
    const remaining = parsed.data.slice(1);

    const BATCH_SIZE = 500;
    for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
      const batch = remaining
        .slice(i, i + BATCH_SIZE)
        .map((row) => clean(mapRow(row, batch_id)));

      const { error } = await supabase.from("contacts").upsert(batch, { onConflict: "hubspot_record_id" });

      if (error) {
        throw new Error(
          `Contacts insert error (batch ${Math.floor(i / BATCH_SIZE) + 1}): ${error.message}`,
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
    console.error("Contacts upload error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
