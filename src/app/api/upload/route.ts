import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-server";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

/** Maximum sizes */
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;  // 10 MB
const VIDEO_MAX_BYTES = 200 * 1024 * 1024; // 200 MB

export async function POST(req: NextRequest) {
  const supabase = createAdminSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Upload not configured" }, { status: 503 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }

  const isImage = IMAGE_TYPES.includes(file.type);
  const isVideo = VIDEO_TYPES.includes(file.type);

  if (!isImage && !isVideo) {
    return NextResponse.json(
      {
        error:
          "Unsupported file type. Accepted: JPEG, PNG, WebP, GIF (images) or MP4, WebM (videos).",
      },
      { status: 400 },
    );
  }

  const maxBytes = isVideo ? VIDEO_MAX_BYTES : IMAGE_MAX_BYTES;
  if (file.size > maxBytes) {
    const maxMb = maxBytes / (1024 * 1024);
    return NextResponse.json(
      { error: `File is too large. Maximum size is ${maxMb} MB.` },
      { status: 400 },
    );
  }

  const folder = (formData.get("folder") as string) || (isVideo ? "videos" : "suppliers");
  const ext = file.name.split(".").pop() || (isVideo ? "mp4" : "png");
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const buf = await file.arrayBuffer();

  // Videos go into the "videos" bucket; images stay in "logos"
  const bucket = isVideo ? "videos" : "logos";

  const { error } = await supabase.storage.from(bucket).upload(path, buf, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
  return NextResponse.json({ url: urlData.publicUrl, type: isVideo ? "video" : "image" });
}
