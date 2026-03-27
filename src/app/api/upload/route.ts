import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-server";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-quicktime",
  "video/3gpp",
  "video/3gpp2",
];
const VIDEO_EXTENSIONS = new Set([
  "mp4", "m4v", "mov", "qt", "webm", "3gp", "3g2",
  "avi", "mkv", "mts", "m2ts", "ts", "mpeg", "mpg",
  "wmv", "flv", "ogv", "mxf",
]);
const GENERIC_VIDEO_TYPES = new Set(["application/octet-stream", "binary/octet-stream"]);

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

  const requestedFolder = ((formData.get("folder") as string) || "").trim().toLowerCase();
  const normalizedType = (file.type || "").toLowerCase().trim();
  const ext = (file.name.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "");

  const isImage = IMAGE_TYPES.includes(normalizedType);
  const isVideoByType =
    normalizedType.startsWith("video/") ||
    VIDEO_TYPES.includes(normalizedType) ||
    GENERIC_VIDEO_TYPES.has(normalizedType);
  const isVideoByExt = VIDEO_EXTENSIONS.has(ext);
  const isVideo = isVideoByType || isVideoByExt || requestedFolder === "videos";

  if (!isImage && !isVideo) {
    return NextResponse.json(
      {
        error:
          "Unsupported file type. Accepted: common image files or video files.",
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

  const folder = requestedFolder || (isVideo ? "videos" : "suppliers");
  const safeExt = ext || (isVideo ? "mp4" : "png");
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExt}`;
  const buf = await file.arrayBuffer();

  // Videos go into the "videos" bucket; images stay in "logos"
  const bucket = isVideo ? "videos" : "logos";

  const resolvedVideoType = normalizedType.startsWith("video/")
    ? normalizedType
    : safeExt === "webm"
      ? "video/webm"
      : safeExt === "mov" || safeExt === "qt"
        ? "video/quicktime"
        : safeExt === "3gp"
          ? "video/3gpp"
          : safeExt === "3g2"
            ? "video/3gpp2"
            : "video/mp4";

  const { error } = await supabase.storage.from(bucket).upload(path, buf, {
    contentType: isVideo ? resolvedVideoType : normalizedType,
    upsert: false,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
  return NextResponse.json({ url: urlData.publicUrl, type: isVideo ? "video" : "image" });
}
