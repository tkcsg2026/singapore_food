import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient, createServerSupabaseClient, requireAdmin } from "@/lib/supabase-server";

function clampText(value: unknown, maxLen: number): string {
  const s = typeof value === "string" ? value.trim() : "";
  if (!s) return "";
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function isMissingTableError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === "42P01";
}

export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  if (!supabase) return NextResponse.json([]);

  const { searchParams } = new URL(req.url);
  const includeDeleted = searchParams.get("includeDeleted") === "1";
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") ?? "50") || 50));

  if (includeDeleted) {
    const adminAuth = await requireAdmin(req);
    if (adminAuth instanceof NextResponse) return adminAuth;

    const admin = createAdminSupabaseClient();
    if (!admin) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    const { data, error } = await admin
      .from("job_notices")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error && isMissingTableError(error)) {
      return NextResponse.json(
        { error: "job_notices setup is pending", code: "JOB_NOTICES_NOT_READY" },
        { status: 503 }
      );
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  }

  const { data, error } = await supabase
    .from("job_notices")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error && isMissingTableError(error)) {
    return NextResponse.json(
      { error: "job_notices setup is pending", code: "JOB_NOTICES_NOT_READY" },
      { status: 503 }
    );
  }
  if (error) return NextResponse.json([]);
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const admin = createAdminSupabaseClient();
  if (!admin) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const body = await req.json().catch(() => ({}));

  const agreed = body?.agreed === true;
  if (!agreed) {
    return NextResponse.json({ error: "Consent required" }, { status: 400 });
  }

  const rawType = body?.post_type;
  const post_type: "job" | "seeker" =
    rawType === "seeker" ? "seeker" : "job";

  const row = {
    post_type,
    title: clampText(body?.title, 120),
    company: clampText(body?.company, 120),
    employment: clampText(body?.employment, 24),
    role_category: clampText(body?.roleCategory, 24),
    region: clampText(body?.region, 24),
    compensation: clampText(body?.compensation, 32),
    experience: clampText(body?.experience, 24),
    eligibility: clampText(body?.eligibility, 24),
    description: clampText(body?.description, 4000),
    agreed: true,
    agreed_at: new Date().toISOString(),
    status: "active" as const,
  };

  if (!row.title || !row.description) {
    return NextResponse.json({ error: "Missing title or description" }, { status: 400 });
  }

  const { data, error } = await admin.from("job_notices").insert(row).select("*").single();
  if (error && isMissingTableError(error)) {
    return NextResponse.json(
      { error: "job_notices setup is pending", code: "JOB_NOTICES_NOT_READY" },
      { status: 503 }
    );
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const adminAuth = await requireAdmin(req);
  if (adminAuth instanceof NextResponse) return adminAuth;
  const supabase = createAdminSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const reason = clampText(body?.reason, 280);

  const { data, error } = await supabase
    .from("job_notices")
    .update({ status: "deleted", deleted_at: new Date().toISOString(), deleted_reason: reason || null })
    .eq("id", id)
    .select("*")
    .single();
  if (error && isMissingTableError(error)) {
    return NextResponse.json(
      { error: "job_notices setup is pending", code: "JOB_NOTICES_NOT_READY" },
      { status: 503 }
    );
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

