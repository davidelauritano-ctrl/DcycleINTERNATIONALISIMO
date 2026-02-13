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

function str(val: string | undefined | null): string | null {
  if (!val || val.trim() === "") return null;
  return val.trim();
}

function parseDatetime(val: string | undefined | null): string | null {
  if (!val || val.trim() === "") return null;
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** Case-insensitive column lookup across multiple possible header names */
function col(row: Record<string, string>, ...names: string[]): string | undefined {
  for (const name of names) {
    if (name in row && row[name] !== "") return row[name];
  }
  const entries = Object.entries(row);
  for (const name of names) {
    const lower = name.toLowerCase();
    for (const [k, v] of entries) {
      if (k.trim().toLowerCase() === lower && v !== "") return v;
    }
  }
  return undefined;
}

/**
 * Map a single CSV row to a leads table record.
 *
 * Expected CSV headers (case-insensitive):
 *   First Name, Last Name, First Email Date, Week, Company, Industry,
 *   Lead Status, First Meeting Done, Number of employees from Company,
 *   TIER, Campaign, Channel, Company Deal, Month, Year, Country,
 *   Campaign Name correct
 */
function mapRow(row: Record<string, string>, batchId: string): Record<string, unknown> {
  const monthVal = col(row, "Month");
  const yearVal = col(row, "Year");
  const month = monthVal ? parseInt(monthVal, 10) : null;
  const year = yearVal ? parseInt(yearVal, 10) : null;
  const monthKey = month && year ? `${month}_${year}` : null;

  return {
    first_name: str(col(row, "First Name", "FirstName")),
    last_name: str(col(row, "Last Name", "LastName")),
    email: str(col(row, "Email", "Email Address")),
    first_email_date: parseDatetime(col(row, "First Email Date")),
    week_number: col(row, "Week", "Week Number")
      ? parseInt(col(row, "Week", "Week Number")!, 10) || null
      : null,
    company_name: str(col(row, "Company", "Company Name")),
    industry: str(col(row, "Industry", "Company Industry")) ?? "-",
    lead_status: str(col(row, "Lead Status", "LeadStatus")),
    first_meeting_set: str(col(row, "First Meeting Done", "First Meeting Set", "Meeting Set")) ?? "Not Found",
    num_employees: col(row, "Number of employees from Company", "Number of Employees", "Employees")
      ? Math.round(parseNum(col(row, "Number of employees from Company", "Number of Employees", "Employees")))
      : null,
    tier: str(col(row, "TIER", "Tier")) ?? "TIER 4",
    campaign_raw: str(col(row, "Campaign", "Campaign Raw", "UTM Campaign")),
    channel: str(col(row, "Channel", "Source", "Traffic Source")),
    deal_amount: parseNum(col(row, "Company Deal", "Deal Amount", "Deal", "Pipeline", "Amount")),
    month_key: monthKey,
    year: year,
    country: str(col(row, "Country", "Country Code")) ?? "-",
    campaign_name_normalized: str(col(row, "Campaign Name correct", "Campaign Name Correct", "Campaign Name Normalized", "Normalized Campaign")) ?? "-",
    upload_batch_id: batchId,
    uploaded_at: new Date().toISOString(),
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

    const csvHeaders = Object.keys(parsed.data[0]);
    console.log("Leads CSV headers:", csvHeaders);

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
      const { error } = await supabase.from("leads").insert([cleaned]);
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
      throw new Error(`Leads insert error (test row): ${testError.message}`);
    }

    if (badCols.size > 0) {
      console.warn("Leads upload: DB columns not found (skipped):", Array.from(badCols));
    }

    // Insert remaining rows in batches
    const remaining = parsed.data.slice(1);

    const BATCH_SIZE = 500;
    for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
      const batch = remaining
        .slice(i, i + BATCH_SIZE)
        .map((row) => clean(mapRow(row, batch_id)));

      const { error } = await supabase.from("leads").insert(batch);

      if (error) {
        throw new Error(
          `Leads insert error (batch ${Math.floor(i / BATCH_SIZE) + 1}): ${error.message}`,
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
    console.error("Leads upload error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
