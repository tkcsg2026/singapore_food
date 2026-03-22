import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase-server";
import { sendReportNotification } from "@/lib/email";

export async function GET() {
  const supabase = createServerSupabaseClient();
  if (!supabase) return NextResponse.json([]);
  const { data, error } = await supabase
    .from("reports").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json([]);
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  // Use admin client so RLS never blocks a legitimate report submission.
  const supabase = createAdminSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const body = await req.json();
  const { data, error } = await supabase.from("reports").insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify admin of new report
  try {
    await sendReportNotification({
      itemId: String(body.item_id || "unknown"),
      reason: body.reason || "",
    });
  } catch {}

  return NextResponse.json(data);
}

export async function PUT(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const body = await req.json();
  const { id, status } = body;
  const { data, error } = await supabase
    .from("reports").update({ status }).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
