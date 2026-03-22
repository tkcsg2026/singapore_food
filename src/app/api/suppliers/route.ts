import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase-server";
import { suppliers as mockSuppliers } from "@/data/mockData";

// Shape mock data to match DB column names
function normaliseMock(s: any) {
  return {
    ...s,
    name_ja: s.nameJa ?? s.name_ja ?? s.name,
    category_ja: s.categoryJa ?? s.category_ja ?? s.category,
    area_ja: s.areaJa ?? s.area_ja ?? s.area,
    description_ja: s.descriptionJa ?? s.description_ja ?? s.description,
  };
}

export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const area = searchParams.get("area");
  const q = searchParams.get("q");

  if (!supabase) {
    let data = mockSuppliers.map(normaliseMock);
    if (category) data = data.filter((s) => s.category === category || (s as any).category_2 === category || (s as any).category_3 === category);
    if (area) data = data.filter((s) => s.area === area);
    if (q) data = data.filter((s) =>
      s.name_ja.includes(q) || s.description_ja.includes(q) || s.category_ja.includes(q)
        || (s as any).category_2_ja?.includes(q) || (s as any).category_3_ja?.includes(q)
    );
    return NextResponse.json(data);
  }

  // Fetch all suppliers; tier ordering + daily-seeded shuffle is applied client-side
  // via sortSuppliersByPlan() so every tier gets fair, rotating exposure.
  let query = supabase.from("suppliers").select("*").order("views", { ascending: false });
  if (category) query = query.or(`category.eq.${category},category_2.eq.${category},category_3.eq.${category}`);
  if (area) query = query.eq("area", area);
  if (q) query = query.or(`name_ja.ilike.%${q}%,description_ja.ilike.%${q}%,category_ja.ilike.%${q}%,category_2_ja.ilike.%${q}%,category_3_ja.ilike.%${q}%`);

  const { data, error } = await query;
  if (error || !data || data.length === 0) {
    let fallback = mockSuppliers.map(normaliseMock);
    if (category) fallback = fallback.filter((s) => s.category === category);
    if (area) fallback = fallback.filter((s) => s.area === area);
    if (q) fallback = fallback.filter((s) =>
      s.name_ja.includes(q) || s.description_ja.includes(q)
    );
    return NextResponse.json(fallback);
  }
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const body = await req.json();
  const { data, error } = await supabase.from("suppliers").insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
