import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-server";
import { sendPasswordResetEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    }

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL || "https://thekitchenconnection.net";
    const redirectTo = `${origin}/reset-password`;

    // Generate the password reset link via the admin API (bypasses Supabase's
    // rate-limited email sender — we send via our own SMTP instead).
    const { data, error } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: email.trim().toLowerCase(),
      options: { redirectTo },
    });

    if (error) {
      // Don't leak whether the email exists — always return success to the client.
      console.error("[reset-password] generateLink error:", error.message);
      return NextResponse.json({ ok: true });
    }

    const resetLink = data?.properties?.action_link;
    if (resetLink) {
      await sendPasswordResetEmail({ userEmail: email.trim(), resetLink });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[reset-password] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
