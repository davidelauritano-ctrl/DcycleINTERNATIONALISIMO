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

    // Probe which columns the deals table actually has
    const { data: probeRow, error: probeError } = await supabase
      .from("deals")
      .select("*")
      .limit(1);

    const existingCols = new Set<string>();
    if (!probeError && probeRow) {
      // If table has rows, get column names from the first row
      if (probeRow.length > 0) {
        for (const key of Object.keys(probeRow[0])) existingCols.add(key);
      }
    }

    // Build rows from CSV, only including columns the DB has
    // If table is empty (can't detect schema), default to NO hubspot_record_id
    const hasHubspotId = existingCols.size > 0 && existingCols.has("hubspot_record_id");

    const rows = parsed.data.map((row) => {
      const mapped: Record<string, unknown> = {
        deal_name: str(row["Deal Name"]) ?? "",
        deal_stage: str(row["Deal Stage"]),
        close_date: parseDatetime(row["Close Date"] ?? row["Close date"]),
        deal_owner: str(row["Deal owner"] ?? row["Deal Owner"]),
        amount: parseNum(row["Amount"]),
        is_closed_won: parseBool(row["Is Closed Won"] ?? row["Closed Won"]),
        is_closed_lost: parseBool(row["Is Closed Lost"] ?? row["Closed Lost"]),
        lost_comments: str(
          row["Lost Comments"] ?? row["Closed Lost Reason"] ?? row["lost_comments"],
        ),
        associated_contact: str(
          row["Associated Contact"] ?? row["Associated Contacts"],
        ),
        associated_company: str(
          row["Associated Company"] ?? row["Associated Companies"],
        ),
        associated_contact_id: parseBigInt(row["Associated Contact ID"]),
        associated_company_id: parseBigInt(row["Associated Company ID"]),
      };

      if (hasHubspotId && row["Record ID"]) {
        mapped.hubspot_record_id = parseBigInt(row["Record ID"]);
      }

      // Only include optional columns if we confirmed they exist
      if (existingCols.has("amount_corrected")) {
        mapped.amount_corrected = row["Amount Corrected"]
          ? parseNum(row["Amount Corrected"])
          : null;
      }

      if (existingCols.has("upload_batch_id")) {
        mapped.upload_batch_id = batch_id;
      }

      // Only include columns the DB actually has (if we detected the schema)
      if (existingCols.size > 0) {
        for (const key of Object.keys(mapped)) {
          if (!existingCols.has(key)) delete mapped[key];
        }
      }

      return mapped;
    });

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No rows found in CSV." },
        { status: 400 },
      );
    }

    const BATCH_SIZE = 500;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);

      let error: { message: string } | null | undefined = null;

      // If the DB has hubspot_record_id, upsert on it
      if (hasHubspotId && batch.some((r) => r.hubspot_record_id)) {
        const res = await supabase
          .from("deals")
          .upsert(batch, { onConflict: "hubspot_record_id" });
        error = res.error;

        // If hubspot_record_id doesn't actually exist, fall back to insert
        if (
          error?.message?.includes("Could not find") &&
          error.message.includes("hubspot_record_id")
        ) {
          const cleaned = batch.map((r) => {
            const c = { ...r };
            delete c.hubspot_record_id;
            return c;
          });
          const res2 = await supabase.from("deals").insert(cleaned);
          error = res2.error;
        }
      } else {
        // No hubspot_record_id — plain insert
        const res = await supabase.from("deals").insert(batch);
        error = res.error;
      }

      if (error) {
        // Last resort: retry stripping unknown columns one by one
        let lastError: { message: string } | null | undefined = error;
        let retryBatch = [...batch];
        let retries = 0;
        while (
          lastError?.message?.includes("Could not find the") &&
          retries < 5
        ) {
          const match = lastError.message.match(
            /Could not find the '(\w+)' column/,
          );
          if (!match) break;
          const badCol = match[1];
          retryBatch = retryBatch.map((r) => {
            const c = { ...r };
            delete c[badCol];
            return c;
          });
          const res = await supabase.from("deals").insert(retryBatch);
          lastError = res.error;
          retries++;
        }

        if (lastError) {
          throw new Error(
            `Deals upsert error (batch ${Math.floor(i / BATCH_SIZE)}): ${lastError.message}`,
          );
        }
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
      rows_processed: rows.length,
      batch_id,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Deals upload error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
