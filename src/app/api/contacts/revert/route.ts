import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { batch_id } = body;

    if (!batch_id) {
      return NextResponse.json(
        { error: "batch_id is required" },
        { status: 400 },
      );
    }

    const supabase = getServiceSupabase();

    const { count, error: countError } = await supabase
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .eq("upload_batch_id", batch_id);

    if (countError) {
      throw new Error(`Count error: ${countError.message}`);
    }

    if (!count || count === 0) {
      return NextResponse.json(
        { error: "No rows found for this batch_id" },
        { status: 404 },
      );
    }

    const { error: deleteError } = await supabase
      .from("contacts")
      .delete()
      .eq("upload_batch_id", batch_id);

    if (deleteError) {
      throw new Error(`Delete error: ${deleteError.message}`);
    }

    await supabase.rpc("refresh_materialized_views");

    return NextResponse.json({
      reverted: true,
      rows_deleted: count,
      batch_id,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Contacts revert error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
