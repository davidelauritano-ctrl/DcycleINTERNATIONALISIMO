import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

// Revert a LinkedIn Ads CSV upload by batch_id
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { batch_id } = body;

    if (!batch_id) {
      return NextResponse.json(
        { error: "batch_id is required" },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();

    // Count rows that will be deleted
    const { count, error: countError } = await supabase
      .from("linkedin_ads_raw")
      .select("*", { count: "exact", head: true })
      .eq("upload_batch_id", batch_id);

    if (countError) {
      throw new Error(`Count error: ${countError.message}`);
    }

    if (!count || count === 0) {
      return NextResponse.json(
        { error: "No rows found for this batch_id" },
        { status: 404 }
      );
    }

    // Delete all rows with this batch_id
    const { error: deleteError } = await supabase
      .from("linkedin_ads_raw")
      .delete()
      .eq("upload_batch_id", batch_id);

    if (deleteError) {
      throw new Error(`Delete error: ${deleteError.message}`);
    }

    return NextResponse.json({
      reverted: true,
      rows_deleted: count,
      batch_id,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("LinkedIn revert error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
