import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient, requireAdmin } from "@/lib/supabase-server";
import { categories as mockSupplierCats, marketplaceCategories as mockMPCats } from "@/data/mockData";
import { resolveCategoryDisplayLabels } from "@/lib/category-display";

const mockCategories = [
  ...mockSupplierCats.map((c, i) => ({ id: `s${i}`, type: "supplier", value: c.value, label: c.label, sort_order: i })),
  ...mockMPCats.map((c, i) => ({ id: `m${i}`, type: "marketplace", value: c.value, label: c.label, sort_order: i })),
  { id: "n1", type: "news", value: "industry", label: "業界ニュース", sort_order: 1 },
  { id: "n2", type: "news", value: "regulation", label: "規制・法律", sort_order: 2 },
  { id: "n3", type: "news", value: "trend", label: "トレンド", sort_order: 3 },
  { id: "n4", type: "news", value: "event", label: "イベント", sort_order: 4 },
];

function normalizeCategoryRows(rows: any[]) {
  return rows.map((c: any) => {
    const { enLabel, jaLabel } = resolveCategoryDisplayLabels(c);
    return { ...c, label: enLabel, label_ja: jaLabel };
  });
}

export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");

  if (!supabase) {
    const data = type ? mockCategories.filter((c) => c.type === type) : mockCategories;
    return NextResponse.json(normalizeCategoryRows(data));
  }

  let query = supabase.from("categories").select("*").order("sort_order");
  if (type) query = query.eq("type", type);

  const { data, error } = await query;
  if (error) {
    const fallback = type ? mockCategories.filter((c) => c.type === type) : mockCategories;
    return NextResponse.json(normalizeCategoryRows(fallback));
  }

  // Deduplicate by (type + value) — prevents accidental cross-type collisions.
  const seen = new Set<string>();
  const unique = (data || []).filter((c: { value: string }) => {
    const key = `${(c as any).type ?? ""}:${c.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return NextResponse.json(normalizeCategoryRows(unique));
}

export async function POST(req: NextRequest) {
  const adminAuth = await requireAdmin(req);
  if (adminAuth instanceof NextResponse) return adminAuth;

  const supabase = createAdminSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const type = String(body?.type ?? "supplier").trim() || "supplier";
  const value = String(body?.value ?? "").trim();
  const label = String(body?.label ?? "").trim();
  if (!value) return NextResponse.json({ error: "value (EN key) is required" }, { status: 400 });
  if (!label) return NextResponse.json({ error: "label (EN) is required" }, { status: 400 });
  const row = {
    type,
    value,
    label,
    label_ja: typeof body?.label_ja === "string" ? body.label_ja.trim() : "",
    sort_order: Number(body?.sort_order) || 0,
  };
  const { data, error } = await supabase
    .from("categories")
    .upsert(row, { onConflict: "type,value" })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const adminAuth = await requireAdmin(req);
  if (adminAuth instanceof NextResponse) return adminAuth;

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

  const { data: target, error: fetchErr } = await supabase
    .from("categories")
    .select("type, value")
    .eq("id", id)
    .single();
  if (fetchErr || !target) {
    return NextResponse.json({ error: fetchErr?.message ?? "Category not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("categories")
    .update(updates)
    .eq("type", target.type)
    .eq("value", target.value)
    .select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const first = Array.isArray(data) && data.length > 0 ? data[0] : null;
  if (!first) return NextResponse.json({ error: "Update returned no rows" }, { status: 500 });
  return NextResponse.json(first);
}

export async function DELETE(req: NextRequest) {
  const adminAuth = await requireAdmin(req);
  if (adminAuth instanceof NextResponse) return adminAuth;

  const supabase = createAdminSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { data: row, error: fetchErr } = await supabase
    .from("categories")
    .select("type, value")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: "Category not found" }, { status: 404 });

  const { error } = await supabase.from("categories").delete().eq("type", row.type).eq("value", row.value);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
