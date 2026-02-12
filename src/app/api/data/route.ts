import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

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

    const month_key = searchParams.get("month_key");
    const country = searchParams.get("country");
    const channel = searchParams.get("channel");

    const supabase = getServiceSupabase();
    let query = supabase.from(entity).select("*");

    // Apply optional filters where the entity has those columns
    if (month_key) {
      query = query.eq("month_key", month_key);
    }

    if (country) {
      query = query.eq("country", country);
    }

    if (channel) {
      query = query.eq("channel", channel);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Supabase query error on ${entity}: ${error.message}`);
    }

    return NextResponse.json(data ?? []);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Data API error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
