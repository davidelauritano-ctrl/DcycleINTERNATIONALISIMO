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

    // Probe which columns the contacts table actually has
    const { data: probeRow, error: probeError } = await supabase
      .from("contacts")
      .select("*")
      .limit(1);

    const existingCols = new Set<string>();
    if (!probeError && probeRow) {
      if (probeRow.length > 0) {
        for (const key of Object.keys(probeRow[0])) existingCols.add(key);
      }
    }

    const hasHubspotId =
      existingCols.size === 0 || existingCols.has("hubspot_record_id");

    const rows = parsed.data.map((row) => {
      const mapped: Record<string, unknown> = {
        first_name: str(row["First Name"]),
        last_name: str(row["Last Name"]),
        email: str(row["Email"]),
        phone: str(row["Phone Number"] ?? row["Phone"]),
        first_email_date: parseDatetime(row["First Email Date"]),
        contact_owner: str(row["Contact owner"] ?? row["Contact Owner"]),
        company_name: str(row["Company Name"] ?? row["Company"]),
        company_industry: str(row["Industry"]),
        lead_status: str(row["Lead Status"]),
        num_employees: row["Number of Employees"]
          ? Math.round(parseNum(row["Number of Employees"]))
          : null,
        linkedin_company_url: str(
          row["LinkedIn Company Page"] ?? row["LinkedIn Company URL"],
        ),
        lead_source: str(row["Lead Source"]),
        lead_origin_multiple: str(
          row["Lead Origin (multiple)"] ?? row["Lead Origin"],
        ),
        original_traffic_source: str(
          row["Original Source"] ?? row["Original Traffic Source"],
        ),
        recent_deal_amount: row["Recent Deal Amount"]
          ? parseNum(row["Recent Deal Amount"])
          : null,
        meeting_date: parseDatetime(row["Meeting Date"]),
        utm_campaign: str(row["UTM Campaign"] ?? row["utm_campaign"]),
        associated_company_id: parseBigInt(row["Associated Company ID"]),
      };

      if (hasHubspotId && row["Record ID"]) {
        mapped.hubspot_record_id = parseBigInt(row["Record ID"]);
      }

      if (existingCols.size === 0 || existingCols.has("upload_batch_id")) {
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

    // Filter out rows without a record ID (only if using hubspot_record_id)
    const validRows =
      hasHubspotId && rows.some((r) => r.hubspot_record_id)
        ? rows.filter((r) => r.hubspot_record_id !== null && r.hubspot_record_id !== undefined)
        : rows;

    if (validRows.length === 0) {
      return NextResponse.json(
        { error: "No valid rows found in CSV." },
        { status: 400 },
      );
    }

    const BATCH_SIZE = 500;

    for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
      const batch = validRows.slice(i, i + BATCH_SIZE);

      let error: { message: string } | null | undefined = null;

      if (hasHubspotId && batch.some((r) => r.hubspot_record_id)) {
        const res = await supabase
          .from("contacts")
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
          const res2 = await supabase.from("contacts").insert(cleaned);
          error = res2.error;
        }
      } else {
        const res = await supabase.from("contacts").insert(batch);
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
          const res = await supabase.from("contacts").insert(retryBatch);
          lastError = res.error;
          retries++;
        }

        if (lastError) {
          throw new Error(
            `Contacts upsert error (batch ${Math.floor(i / BATCH_SIZE)}): ${lastError.message}`,
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
      rows_processed: validRows.length,
      rows_skipped: rows.length - validRows.length,
      batch_id,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Contacts upload error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
