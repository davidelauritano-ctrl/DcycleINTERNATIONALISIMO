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
        { status: 400 },
      );
    }

    const batch_id = uuidv4();
    const supabase = getServiceSupabase();

    const rows = parsed.data.map((row) => ({
      hubspot_record_id: parseBigInt(row["Record ID"]),
      deal_name: str(row["Deal Name"]) ?? "",
      deal_stage: str(row["Deal Stage"]),
      close_date: parseDatetime(row["Close Date"] ?? row["Close date"]),
      deal_owner: str(row["Deal owner"] ?? row["Deal Owner"]),
      amount: parseNum(row["Amount"]),
      amount_corrected: row["Amount Corrected"]
        ? parseNum(row["Amount Corrected"])
        : null,
      is_closed_won: parseBool(row["Is Closed Won"] ?? row["Closed Won"]),
      is_closed_lost: parseBool(row["Is Closed Lost"] ?? row["Closed Lost"]),
      lost_comments: str(row["Lost Comments"] ?? row["Closed Lost Reason"]),
      associated_contact: str(
        row["Associated Contact"] ?? row["Associated Contacts"],
      ),
      associated_company: str(
        row["Associated Company"] ?? row["Associated Companies"],
      ),
      associated_contact_id: parseBigInt(row["Associated Contact ID"]),
      associated_company_id: parseBigInt(row["Associated Company ID"]),
      upload_batch_id: batch_id,
    }));

    // Filter out rows without a record ID
    const validRows = rows.filter((r) => r.hubspot_record_id !== null);

    if (validRows.length === 0) {
      return NextResponse.json(
        {
          error:
            'No valid rows found. Ensure the CSV has a "Record ID" column.',
        },
        { status: 400 },
      );
    }

    // Detect which columns the DB actually has by trying a small upsert first
    const columnsToRemove: string[] = [];
    const BATCH_SIZE = 500;

    function stripMissing<T extends Record<string, unknown>>(rows: T[]): T[] {
      if (columnsToRemove.length === 0) return rows;
      return rows.map((row) => {
        const clean = { ...row };
        for (const col of columnsToRemove) delete clean[col];
        return clean;
      });
    }

    for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
      const rawBatch = validRows.slice(i, i + BATCH_SIZE);
      let batch = stripMissing(rawBatch);

      let { error } = await supabase
        .from("deals")
        .upsert(batch, { onConflict: "hubspot_record_id" });

      // If a column doesn't exist, remove it and retry (max 5 to prevent infinite loop)
      let retries = 0;
      while (error?.message?.includes("Could not find the") && retries < 5) {
        const match = error.message.match(/Could not find the '(\w+)' column/);
        if (!match) break;
        columnsToRemove.push(match[1]);
        batch = stripMissing(rawBatch);
        const retry = await supabase
          .from("deals")
          .upsert(batch, { onConflict: "hubspot_record_id" });
        error = retry.error;
        retries++;
      }

      if (error) {
        throw new Error(
          `Deals upsert error (batch ${Math.floor(i / BATCH_SIZE)}): ${error.message}`,
        );
      }
    }

    // Refresh materialized views
    const { error: rpcError } = await supabase.rpc(
      "refresh_materialized_views",
    );
    if (rpcError) {
      console.error("Failed to refresh materialized views:", rpcError.message);
    }

    return NextResponse.json({
      rows_processed: validRows.length,
      rows_skipped: rows.length - validRows.length,
      batch_id,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Deals upload error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
