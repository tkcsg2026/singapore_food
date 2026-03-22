import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase-server";
import { categories as mockSupplierCats, marketplaceCategories as mockMPCats } from "@/data/mockData";

const mockCategories = [
  ...mockSupplierCats.map((c, i) => ({ id: `s${i}`, type: "supplier", value: c.value, label: c.label, sort_order: i })),
  ...mockMPCats.map((c, i) => ({ id: `m${i}`, type: "marketplace", value: c.value, label: c.label, sort_order: i })),
  { id: "n1", type: "news", value: "industry", label: "業界ニュース", sort_order: 1 },
  { id: "n2", type: "news", value: "regulation", label: "規制・法律", sort_order: 2 },
  { id: "n3", type: "news", value: "trend", label: "トレンド", sort_order: 3 },
  { id: "n4", type: "news", value: "event", label: "イベント", sort_order: 4 },
];

export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");

  if (!supabase) {
    const data = type ? mockCategories.filter((c) => c.type === type) : mockCategories;
    return NextResponse.json(data);
  }

  let query = supabase.from("categories").select("*").order("sort_order");
  if (type) query = query.eq("type", type);

  const { data, error } = await query;
  if (error) {
    const fallback = type ? mockCategories.filter((c) => c.type === type) : mockCategories;
    return NextResponse.json(fallback);
  }

  // Deduplicate by value — prevents double entries if SQL seed was run more than once
  const seen = new Set<string>();
  const unique = (data || []).filter((c: { value: string }) => {
    if (seen.has(c.value)) return false;
    seen.add(c.value);
    return true;
  });
  return NextResponse.json(unique);
}

export async function POST(req: NextRequest) {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const body = await req.json();
  const { data, error } = await supabase.from("categories").insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const body = await req.json();
  const updates: Record<string, string> = {};
  if (typeof body.label === "string") updates.label = body.label.trim();
  if (typeof body.label_ja === "string") updates.label_ja = body.label_ja.trim();
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  const { data, error } = await supabase.from("categories").update(updates).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
