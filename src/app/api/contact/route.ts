import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-server";
import { sendContactEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, email, subject, message } = body;

  if (!name || !email || !subject || !message) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  // Send email via SMTP to japan.dev07@gmail.com (or CONTACT_EMAIL_TO)
  const emailSent = await sendContactEmail({ name, email, subject, message });
  if (!emailSent) {
    return NextResponse.json(
      { error: "Email service is not configured. Please set SMTP_HOST, SMTP_USER, and SMTP_PASS." },
      { status: 503 }
    );
  }

  const supabase = createAdminSupabaseClient();
  if (supabase) {
    try {
      await supabase.from("contact_messages").insert({ name, email, subject, message });
    } catch {
      // Table might not exist; email was sent, so we still return success
    }
  }

  return NextResponse.json({ success: true });
}
