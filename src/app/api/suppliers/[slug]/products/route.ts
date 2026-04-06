import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient, requireAdmin } from "@/lib/supabase-server";
import { getVideoTranscodeStateForUrl } from "@/lib/video";

type AdminClient = NonNullable<ReturnType<typeof createAdminSupabaseClient>>;

const OPTIONAL_PRODUCT_COLUMNS = [
  "country_of_origin_en",
  "video_playback_url",
  "video_transcoded_url",
  "video_transcode_status",
  "video_transcode_error",
  "video_transcode_requested_at",
  "video_transcoded_at",
] as const;

function stripUnsupportedColumns(payload: Record<string, unknown>, errorMessage: string) {
  const unsupported = OPTIONAL_PRODUCT_COLUMNS.filter((col) => errorMessage.includes(col));
  if (unsupported.length === 0) return null;
  const next = { ...payload };
  for (const col of unsupported) delete next[col];
  return next;
}

async function insertWithSchemaFallback(admin: AdminClient, payload: Record<string, unknown>) {
  let currentPayload = { ...payload };
  const maxAttempts = OPTIONAL_PRODUCT_COLUMNS.length + 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await admin
      .from("supplier_products")
      .insert(currentPayload)
      .select()
      .single();
    if (!result.error) return result;

    const stripped = stripUnsupportedColumns(currentPayload, result.error.message);
    if (!stripped) return result;
    currentPayload = stripped;
  }

  return await admin
    .from("supplier_products")
    .insert(currentPayload)
    .select()
    .single();
}

async function updateWithSchemaFallback(
  admin: AdminClient,
  supplierId: string,
  id: string,
  payload: Record<string, unknown>,
) {
  let currentPayload = { ...payload };
  const maxAttempts = OPTIONAL_PRODUCT_COLUMNS.length + 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await admin
      .from("supplier_products")
      .update(currentPayload)
      .eq("id", id)
      .eq("supplier_id", supplierId)
      .select()
      .single();
    if (!result.error) return result;

    const stripped = stripUnsupportedColumns(currentPayload, result.error.message);
    if (!stripped) return result;
    currentPayload = stripped;
  }

  return await admin
    .from("supplier_products")
    .update(currentPayload)
    .eq("id", id)
    .eq("supplier_id", supplierId)
    .select()
    .single();
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug: slugParam } = await params;
  const slug = decodeURIComponent(slugParam);
  const supabase = createServerSupabaseClient();
  const admin = createAdminSupabaseClient();
  const client = admin ?? supabase;
  if (!client) return NextResponse.json([]);

  const { data: supplier } = await client
    .from("suppliers")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!supplier) return NextResponse.json([]);

  const { data: products } = await client
    .from("supplier_products")
    .select("*")
    .eq("supplier_id", supplier.id);

  const normalisedProducts = (products || []).map((p: Record<string, unknown>) => ({
    ...p,
    video_playback_url: (p.video_playback_url as string) || (p.video_transcoded_url as string) || (p.video_url as string) || "",
    video_transcoded_url: (p.video_transcoded_url as string) || "",
    video_transcode_status: (p.video_transcode_status as string) || ((p.video_url as string) ? "not_needed" : "none"),
    video_transcode_error: (p.video_transcode_error as string) || "",
    video_transcode_requested_at: (p.video_transcode_requested_at as string) || null,
    video_transcoded_at: (p.video_transcoded_at as string) || null,
  }));

  return NextResponse.json(normalisedProducts);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const adminAuth = await requireAdmin(req);
  if (adminAuth instanceof NextResponse) return adminAuth;

  const { slug: slugParam } = await params;
  const slug = decodeURIComponent(slugParam);
  const admin = createAdminSupabaseClient();
  if (!admin) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const { data: supplier } = await admin
    .from("suppliers")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!supplier) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

  const body = await req.json();
  const str = (v: unknown) => (v != null ? String(v).trim() : "");
  const videoUrl = str(body.video_url);
  const payload: Record<string, unknown> = {
    supplier_id: supplier.id,
    name:              str(body.name),
    name_en:           str(body.name_en),
    image:             str(body.image),
    moq:               str(body.moq),
    country_of_origin: str(body.country_of_origin),
    country_of_origin_en: str(body.country_of_origin_en),
    weight:            str(body.weight),
    quantity:          str(body.quantity),
    size_w:            str(body.size_w),
    size_d:            str(body.size_d),
    size_h:            str(body.size_h),
    size_unit:         str(body.size_unit) || "cm",
    storage_condition: str(body.storage_condition),
    temperature:       str(body.temperature),
    video_url:         videoUrl,
  };
  const videoTranscode = getVideoTranscodeStateForUrl(videoUrl);
  payload.video_playback_url = videoTranscode.video_playback_url;
  payload.video_transcoded_url = videoTranscode.video_transcoded_url;
  payload.video_transcode_status = videoTranscode.video_transcode_status;
  payload.video_transcode_error = videoTranscode.video_transcode_error;
  payload.video_transcode_requested_at = videoTranscode.video_transcode_requested_at;
  payload.video_transcoded_at = videoTranscode.video_transcoded_at;

  const { data, error } = await insertWithSchemaFallback(admin, payload);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const adminAuth = await requireAdmin(req);
  if (adminAuth instanceof NextResponse) return adminAuth;

  const { slug: slugParam } = await params;
  const slug = decodeURIComponent(slugParam);
  const admin = createAdminSupabaseClient();
  if (!admin) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const { data: supplier } = await admin
    .from("suppliers")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!supplier) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

  const body = await req.json();
  const id = body.id;
  if (!id) return NextResponse.json({ error: "Product id required" }, { status: 400 });

  const str = (v: unknown) => (v != null ? String(v).trim() : "");
  const videoUrl = str(body.video_url);
  const payload: Record<string, unknown> = {
    name:              str(body.name),
    name_en:           str(body.name_en),
    image:             str(body.image),
    moq:               str(body.moq),
    country_of_origin: str(body.country_of_origin),
    country_of_origin_en: str(body.country_of_origin_en),
    weight:            str(body.weight),
    quantity:          str(body.quantity),
    size_w:            str(body.size_w),
    size_d:            str(body.size_d),
    size_h:            str(body.size_h),
    size_unit:         str(body.size_unit) || "cm",
    storage_condition: str(body.storage_condition),
    temperature:       str(body.temperature),
    video_url:         videoUrl,
  };
  const videoTranscode = getVideoTranscodeStateForUrl(videoUrl);
  payload.video_playback_url = videoTranscode.video_playback_url;
  payload.video_transcoded_url = videoTranscode.video_transcoded_url;
  payload.video_transcode_status = videoTranscode.video_transcode_status;
  payload.video_transcode_error = videoTranscode.video_transcode_error;
  payload.video_transcode_requested_at = videoTranscode.video_transcode_requested_at;
  payload.video_transcoded_at = videoTranscode.video_transcoded_at;

  const { data, error } = await updateWithSchemaFallback(admin, supplier.id, id, payload);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const adminAuth = await requireAdmin(req);
  if (adminAuth instanceof NextResponse) return adminAuth;

  const admin = createAdminSupabaseClient();
  if (!admin) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Product id required" }, { status: 400 });

  const { error } = await admin.from("supplier_products").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
