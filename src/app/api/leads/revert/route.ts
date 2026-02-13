import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const { batch_id } = await request.json();

    if (!batch_id) {
      return NextResponse.json(
        { error: "batch_id is required" },
        { status: 400 },
      );
    }

    const supabase = getServiceSupabase();

    const { data, error: deleteError } = await supabase
      .from("leads")
      .delete()
      .eq("upload_batch_id", batch_id)
      .select("id");

    const count = data?.length ?? 0;

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
    console.error("Leads revert error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
