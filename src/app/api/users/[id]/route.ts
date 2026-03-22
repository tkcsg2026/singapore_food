import { NextRequest, NextResponse } from "next/server";
import {
  createAdminSupabaseClient,
  requireAdmin,
  logAuditAction,
} from "@/lib/supabase-server";
import { sendAdminActionEmail } from "@/lib/email";

/** GET /api/users/[id] — Fetch a single user (admin only). */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const admin = createAdminSupabaseClient();
  if (!admin) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const { data, error } = await admin
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json(data);
}

/** PUT /api/users/[id] — Update a user (admin only). */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const admin = createAdminSupabaseClient();
  if (!admin) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const body = await req.json();
  const allowed = ["name", "username", "email", "whatsapp", "company", "role", "banned", "avatar_url"];
  const payload: Record<string, unknown> = {};
  for (const k of allowed) {
    if (body[k] !== undefined) payload[k] = body[k];
  }

  if (typeof body.email === "string" && body.email.trim()) {
    await admin.auth.admin.updateUserById(id, { email: body.email.trim() });
  }

  const { data, error } = await admin
    .from("profiles")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Determine audit action label
  let action = "update_user";
  if (payload.banned === true)  action = "ban_user";
  if (payload.banned === false) action = "unban_user";

  const changedFields = Object.keys(payload).join(", ");
  const nameEmail = (data as any).name
    ? `${(data as any).name}${(data as any).email ? ` (${(data as any).email})` : ""}`
    : id;
  await logAuditAction({
    adminId: auth.adminId,
    action,
    targetType: "user",
    targetId: id,
    detail: action === "ban_user" || action === "unban_user"
      ? nameEmail
      : `${nameEmail} — fields: ${changedFields}`,
  });

  if ((action === "ban_user" || action === "unban_user") && (data as any).email) {
    await sendAdminActionEmail({
      action: action === "ban_user" ? "ban" : "unban",
      userName: (data as any).name || "User",
      userEmail: (data as any).email,
    });
  }

  return NextResponse.json(data);
}

/** DELETE /api/users/[id] — Permanently delete a user (admin only). */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const admin = createAdminSupabaseClient();
  if (!admin) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  // Fetch name/email before deletion for the audit record
  const { data: target } = await admin
    .from("profiles")
    .select("name, email")
    .eq("id", id)
    .single();

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAuditAction({
    adminId: auth.adminId,
    action: "delete_user",
    targetType: "user",
    targetId: id,
    detail: target ? `${target.name} (${target.email})` : id,
  });

  if (target?.email) {
    await sendAdminActionEmail({
      action: "delete",
      userName: target.name || "User",
      userEmail: target.email,
    });
  }

  return NextResponse.json({ success: true });
}
