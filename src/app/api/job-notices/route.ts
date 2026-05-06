import { NextRequest, NextResponse } from "next/server";
import {
  createAdminSupabaseClient,
  createServerSupabaseClient,
  requireAdmin,
  requireAuth,
  logAuditAction,
} from "@/lib/supabase-server";

function clampText(value: unknown, maxLen: number): string {
  const s = typeof value === "string" ? value.trim() : "";
  if (!s) return "";
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

/**
 * Postgres undefined_table (42P01) or PostgREST "schema cache" / PGRST205 when
 * `job_notices` was never created or API reload has not picked it up yet.
 */
function isJobNoticesUnavailableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const o = error as { code?: string; message?: string; details?: string; hint?: string };
  const code = o.code ?? "";
  if (code === "42P01" || code === "PGRST205") return true;
  const blob = [o.message, o.details, o.hint].filter(Boolean).join(" ").toLowerCase();
  if (!blob.includes("job_notices")) return false;
  return (
    blob.includes("schema cache") ||
    blob.includes("does not exist") ||
    blob.includes("could not find") ||
    blob.includes("not found")
  );
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
    if (error && isJobNoticesUnavailableError(error)) {
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
  if (error && isJobNoticesUnavailableError(error)) {
    return NextResponse.json(
      { error: "job_notices setup is pending", code: "JOB_NOTICES_NOT_READY" },
      { status: 503 }
    );
  }
  if (error) return NextResponse.json([]);
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

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
    image: clampText(body?.image, 1000),
    agreed: true,
    agreed_at: new Date().toISOString(),
    status: "active" as const,
    created_by: auth.userId,
  };

  if (!row.title || !row.description) {
    return NextResponse.json({ error: "Missing title or description" }, { status: 400 });
  }

  const { data, error } = await admin.from("job_notices").insert(row).select("*").single();
  if (error && isJobNoticesUnavailableError(error)) {
    return NextResponse.json(
      { error: "job_notices setup is pending", code: "JOB_NOTICES_NOT_READY" },
      { status: 503 }
    );
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const supabase = createAdminSupabaseClient();
  const server = createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const adminAuth = await requireAdmin(req);
  const isAdmin = !(adminAuth instanceof NextResponse);
  let allowEdit = isAdmin;
  let editorUserId: string | null = isAdmin ? (adminAuth as { adminId: string }).adminId : null;

  if (!allowEdit) {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (token && server) {
      const { data: { user } } = await server.auth.getUser(token);
      if (user?.id) {
        const { data: row } = await supabase
          .from("job_notices")
          .select("created_by")
          .eq("id", id)
          .single();
        if (row?.created_by && row.created_by === user.id) {
          allowEdit = true;
          editorUserId = user.id;
        }
      }
    }
  }

  if (!allowEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));

  // Whitelist of fields the user (or admin) is allowed to update via this endpoint.
  const updates: Record<string, unknown> = {};
  if (typeof body.title !== "undefined")        updates.title        = clampText(body.title, 120);
  if (typeof body.company !== "undefined")      updates.company      = clampText(body.company, 120);
  if (typeof body.employment !== "undefined")   updates.employment   = clampText(body.employment, 24);
  if (typeof body.roleCategory !== "undefined") updates.role_category = clampText(body.roleCategory, 24);
  if (typeof body.region !== "undefined")       updates.region       = clampText(body.region, 24);
  if (typeof body.compensation !== "undefined") updates.compensation = clampText(body.compensation, 32);
  if (typeof body.experience !== "undefined")   updates.experience   = clampText(body.experience, 24);
  if (typeof body.eligibility !== "undefined")  updates.eligibility  = clampText(body.eligibility, 24);
  if (typeof body.description !== "undefined") updates.description  = clampText(body.description, 4000);
  if (typeof body.image !== "undefined")        updates.image        = clampText(body.image, 1000);

  if (!updates.title && typeof body.title !== "undefined") {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (!updates.description && typeof body.description !== "undefined") {
    return NextResponse.json({ error: "Description is required" }, { status: 400 });
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields provided" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("job_notices")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();
  if (error && isJobNoticesUnavailableError(error)) {
    return NextResponse.json(
      { error: "job_notices setup is pending", code: "JOB_NOTICES_NOT_READY" },
      { status: 503 }
    );
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Job notice not found" }, { status: 404 });

  if (isAdmin && editorUserId) {
    await logAuditAction({
      adminId: editorUserId,
      action: data.post_type === "seeker" ? "edit_seeker_notice" : "edit_job_notice",
      targetType: "job_notice",
      targetId: id,
      detail: data.title ?? "",
    });
  }

  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const supabase = createAdminSupabaseClient();
  const server = createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const reason = clampText(body?.reason, 280);

  const adminAuth = await requireAdmin(req);
  const isAdmin = !(adminAuth instanceof NextResponse);
  let allowDelete = isAdmin;

  if (!allowDelete) {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (token && server) {
      const { data: { user } } = await server.auth.getUser(token);
      if (user?.id) {
        const { data: row } = await supabase
          .from("job_notices")
          .select("created_by")
          .eq("id", id)
          .single();
        if (row?.created_by && row.created_by === user.id) allowDelete = true;
      }
    }
  }

  if (!allowDelete) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("job_notices")
    .delete()
    .eq("id", id)
    .select("*");
  if (error && isJobNoticesUnavailableError(error)) {
    return NextResponse.json(
      { error: "job_notices setup is pending", code: "JOB_NOTICES_NOT_READY" },
      { status: 503 }
    );
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Job notice not found" }, { status: 404 });
  }

  const deleted = data[0];
  if (isAdmin) {
    const pt = deleted.post_type ?? "job";
    await logAuditAction({
      adminId: adminAuth.adminId,
      action: pt === "seeker" ? "delete_seeker_notice" : "delete_job_notice",
      targetType: "job_notice",
      targetId: id,
      detail: `${deleted.title ?? ""}${pt === "seeker" ? " (seeker)" : " (job)"}`.trim(),
    });
  }

  return NextResponse.json(deleted);
}

