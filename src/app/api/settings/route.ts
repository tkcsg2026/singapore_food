import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");

  if (!supabase) {
    if (key === "qr_redirect_url") return NextResponse.json({ key, value: "/suppliers" });
    if (key) return NextResponse.json({ key, value: null });
    return NextResponse.json([{ key: "qr_redirect_url", value: "/suppliers" }]);
  }

  if (key) {
    const { data, error } = await supabase.from("site_settings").select("*").eq("key", key).single();
    if (error) return NextResponse.json({ key, value: null });
    return NextResponse.json(data);
  }

  const { data, error } = await supabase.from("site_settings").select("*");
  if (error) return NextResponse.json([]);
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest) {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const body = await req.json();
  const { key, value } = body;
  const { data, error } = await supabase.from("site_settings").upsert({ key, value }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
