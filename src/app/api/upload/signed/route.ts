import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-server";

const VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-quicktime",
  "video/3gpp",
  "video/3gpp2",
];
const VIDEO_MAX_BYTES = 200 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const supabase = createAdminSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Upload not configured" }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const fileName = typeof body.fileName === "string" ? body.fileName : "";
  const fileType = typeof body.fileType === "string" ? body.fileType : "";
  const fileSize = typeof body.fileSize === "number" ? body.fileSize : 0;
  const folder = typeof body.folder === "string" && body.folder.trim() ? body.folder.trim() : "videos";

  if (!fileName) return NextResponse.json({ error: "fileName is required" }, { status: 400 });
  if (!VIDEO_TYPES.includes(fileType)) {
    return NextResponse.json({ error: "Unsupported video type. Use MP4 / WebM / MOV / 3GP." }, { status: 400 });
  }
  if (fileSize > VIDEO_MAX_BYTES) {
    return NextResponse.json({ error: "File is too large. Maximum size is 200 MB." }, { status: 400 });
  }

  const sanitizedExt = (fileName.split(".").pop() || "mp4").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${sanitizedExt || "mp4"}`;
  const bucket = "videos";

  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data?.token) {
    return NextResponse.json({ error: error?.message || "Failed to create upload URL" }, { status: 500 });
  }

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
  return NextResponse.json({
    bucket,
    path,
    token: data.token,
    publicUrl: urlData.publicUrl,
  });
}
