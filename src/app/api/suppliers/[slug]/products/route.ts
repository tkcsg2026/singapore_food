import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase-server";

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

  return NextResponse.json(products || []);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
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
  const payload: Record<string, string> = {
    supplier_id: supplier.id,
    name:              str(body.name),
    name_en:           str(body.name_en),
    image:             str(body.image),
    moq:               str(body.moq),
    country_of_origin: str(body.country_of_origin),
    weight:            str(body.weight),
    quantity:          str(body.quantity),
    size_w:            str(body.size_w),
    size_d:            str(body.size_d),
    size_h:            str(body.size_h),
    size_unit:         str(body.size_unit) || "cm",
    storage_condition: str(body.storage_condition),
    temperature:       str(body.temperature),
    video_url:         str(body.video_url),
  };

  const { data, error } = await admin
    .from("supplier_products")
    .insert(payload)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
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
  const payload: Record<string, string> = {
    name:              str(body.name),
    name_en:           str(body.name_en),
    image:             str(body.image),
    moq:               str(body.moq),
    country_of_origin: str(body.country_of_origin),
    weight:            str(body.weight),
    quantity:          str(body.quantity),
    size_w:            str(body.size_w),
    size_d:            str(body.size_d),
    size_h:            str(body.size_h),
    size_unit:         str(body.size_unit) || "cm",
    storage_condition: str(body.storage_condition),
    temperature:       str(body.temperature),
    video_url:         str(body.video_url),
  };

  const { data, error } = await admin
    .from("supplier_products")
    .update(payload)
    .eq("id", id)
    .eq("supplier_id", supplier.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const admin = createAdminSupabaseClient();
  if (!admin) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Product id required" }, { status: 400 });

  const { error } = await admin.from("supplier_products").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
