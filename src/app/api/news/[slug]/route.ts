import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data, error } = await supabase
    .from("news_articles").select("*").eq("slug", slug).single();
  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const body = await req.json();
  const { data, error } = await supabase
    .from("news_articles").update(body).eq("slug", slug).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const { error } = await supabase.from("news_articles").delete().eq("slug", slug);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
