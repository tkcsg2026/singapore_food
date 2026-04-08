import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * POST /api/analytics/supplier-whatsapp-click
 * Body: { supplierId: string } — records one WhatsApp tap for that supplier profile.
 */
export async function POST(req: NextRequest) {
  let body: { supplierId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const supplierId = typeof body.supplierId === "string" ? body.supplierId.trim() : "";
  if (!supplierId || !UUID_RE.test(supplierId)) {
    return NextResponse.json({ error: "Invalid supplierId" }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  if (!admin) return NextResponse.json({ ok: false }, { status: 503 });

  const { data: row, error: selErr } = await admin
    .from("suppliers")
    .select("id, whatsapp_clicks")
    .eq("id", supplierId)
    .maybeSingle();

  if (selErr || !row) {
    return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
  }

  const { error: logErr } = await admin.from("whatsapp_click_logs").insert({ supplier_id: supplierId });
  if (logErr) {
    return NextResponse.json({ error: logErr.message }, { status: 500 });
  }

  const next = (Number(row.whatsapp_clicks) || 0) + 1;
  const { error: upErr } = await admin.from("suppliers").update({ whatsapp_clicks: next }).eq("id", supplierId);
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/**
 * GET /api/analytics/supplier-whatsapp-click?months=6&supplierId=<uuid>
 * Monthly WhatsApp tap counts (site-wide or one supplier).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const months = parseInt(searchParams.get("months") ?? "6", 10);
  const supplierId = searchParams.get("supplierId");
  const admin = createAdminSupabaseClient();
  if (!admin) return NextResponse.json([]);

  const since = new Date();
  since.setMonth(since.getMonth() - months + 1);
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  let query = admin
    .from("whatsapp_click_logs")
    .select("clicked_at")
    .gte("clicked_at", since.toISOString());

  if (supplierId && UUID_RE.test(supplierId)) query = query.eq("supplier_id", supplierId);

  const { data, error } = await query;
  if (error || !data) return NextResponse.json([]);

  const buckets: Record<string, number> = {};
  for (const row of data) {
    const key = (row.clicked_at as string).slice(0, 7);
    buckets[key] = (buckets[key] ?? 0) + 1;
  }

  const result: { month: string; clicks: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    result.push({ month: key, clicks: buckets[key] ?? 0 });
  }

  return NextResponse.json(result);
}
