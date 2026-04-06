import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { suppliers as mockSuppliers } from "@/data/mockData";
import { countSuppliersByPlan } from "@/lib/plans";

function normaliseMock(s: (typeof mockSuppliers)[0]) {
  return {
    ...s,
    name_ja: s.nameJa ?? s.name_ja ?? s.name,
    category_ja: s.categoryJa ?? s.category_ja ?? s.category,
    area_ja: s.areaJa ?? s.area_ja ?? s.area,
    description_ja: s.descriptionJa ?? s.description_ja ?? s.description,
  };
}

/** Exact tier counts for the whole `suppliers` table (not limited by list pagination). */
export async function GET() {
  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json(countSuppliersByPlan(mockSuppliers.map(normaliseMock)));
  }

  const { count: total, error: errTotal } = await supabase
    .from("suppliers")
    .select("*", { count: "exact", head: true });
  const { count: premium, error: errP } = await supabase
    .from("suppliers")
    .select("*", { count: "exact", head: true })
    .eq("plan", "premium");
  const { count: standard, error: errS } = await supabase
    .from("suppliers")
    .select("*", { count: "exact", head: true })
    .eq("plan", "standard");

  if (errTotal || errP || errS || total == null) {
    return NextResponse.json(countSuppliersByPlan(mockSuppliers.map(normaliseMock)));
  }

  const basic = Math.max(0, total - (premium ?? 0) - (standard ?? 0));
  return NextResponse.json({
    premium: premium ?? 0,
    standard: standard ?? 0,
    basic,
  });
}
