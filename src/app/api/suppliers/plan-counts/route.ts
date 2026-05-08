import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { suppliers as mockSuppliers } from "@/data/mockData";
import { countSuppliersByPlan } from "@/lib/plans";

/** Exact tier counts for the whole `suppliers` table (not limited by list pagination). */
export async function GET() {
  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json(countSuppliersByPlan(mockSuppliers));
  }

  // Try with hidden=false filter; fall back if the column doesn't exist yet.
  const filterVisible = (qb: ReturnType<typeof supabase.from> extends infer T ? any : any) =>
    qb.or("hidden.is.null,hidden.eq.false");

  const tryCount = async (
    base: () => any,
    withHiddenFilter: boolean,
  ): Promise<{ count: number | null; error: any }> => {
    const q = withHiddenFilter ? filterVisible(base()) : base();
    const { count, error } = await q;
    return { count, error };
  };

  // First attempt — with hidden filter
  let totalRes = await tryCount(() => supabase.from("suppliers").select("*", { count: "exact", head: true }), true);
  let premiumRes = await tryCount(() => supabase.from("suppliers").select("*", { count: "exact", head: true }).eq("plan", "premium"), true);
  let standardRes = await tryCount(() => supabase.from("suppliers").select("*", { count: "exact", head: true }).eq("plan", "standard"), true);

  // If the hidden column does not exist (older schema), retry without filter
  const hiddenMissing = (e: any) => /column .*hidden/i.test(String(e?.message || ""));
  if (hiddenMissing(totalRes.error) || hiddenMissing(premiumRes.error) || hiddenMissing(standardRes.error)) {
    totalRes = await tryCount(() => supabase.from("suppliers").select("*", { count: "exact", head: true }), false);
    premiumRes = await tryCount(() => supabase.from("suppliers").select("*", { count: "exact", head: true }).eq("plan", "premium"), false);
    standardRes = await tryCount(() => supabase.from("suppliers").select("*", { count: "exact", head: true }).eq("plan", "standard"), false);
  }

  if (totalRes.error || premiumRes.error || standardRes.error || totalRes.count == null) {
    return NextResponse.json(countSuppliersByPlan(mockSuppliers));
  }

  const basic = Math.max(0, totalRes.count - (premiumRes.count ?? 0) - (standardRes.count ?? 0));
  return NextResponse.json({
    premium: premiumRes.count ?? 0,
    standard: standardRes.count ?? 0,
    basic,
  });
}
