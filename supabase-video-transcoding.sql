-- Video transcoding pipeline schema for supplier_products.
-- Run this SQL in Supabase SQL Editor after backing up your DB.

-- 1) Extend supplier_products for transcode lifecycle tracking.
ALTER TABLE public.supplier_products
  ADD COLUMN IF NOT EXISTS video_playback_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS video_transcoded_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS video_source_mime text DEFAULT '',
  ADD COLUMN IF NOT EXISTS video_transcode_status text DEFAULT 'none'
    CHECK (video_transcode_status IN ('none', 'not_needed', 'queued', 'processing', 'completed', 'failed')),
  ADD COLUMN IF NOT EXISTS video_transcode_error text DEFAULT '',
  ADD COLUMN IF NOT EXISTS video_transcode_requested_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS video_transcoded_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_supplier_products_transcode_status
  ON public.supplier_products (video_transcode_status);

-- 2) Queue table consumed by ffmpeg worker.
CREATE TABLE IF NOT EXISTS public.video_transcode_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.supplier_products(id) ON DELETE CASCADE,
  source_url text NOT NULL,
  source_mime text DEFAULT '',
  output_ext text DEFAULT 'mp4',
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text DEFAULT '',
  worker_id text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz NULL,
  finished_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_video_transcode_jobs_status_created
  ON public.video_transcode_jobs(status, created_at);

-- Keep updated_at fresh on updates.
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_video_transcode_jobs_touch_updated_at ON public.video_transcode_jobs;
CREATE TRIGGER trg_video_transcode_jobs_touch_updated_at
BEFORE UPDATE ON public.video_transcode_jobs
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) Trigger: enqueue jobs whenever non-browser-native source is marked queued.
CREATE OR REPLACE FUNCTION public.enqueue_video_transcode_job()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.video_transcode_status = 'queued'
     AND coalesce(NEW.video_url, '') <> ''
     AND (
       TG_OP = 'INSERT'
       OR coalesce(OLD.video_url, '') IS DISTINCT FROM coalesce(NEW.video_url, '')
       OR coalesce(OLD.video_transcode_status, '') IS DISTINCT FROM coalesce(NEW.video_transcode_status, '')
     )
  THEN
    INSERT INTO public.video_transcode_jobs(product_id, source_url, status)
    VALUES (NEW.id, NEW.video_url, 'queued');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_supplier_products_enqueue_video_transcode ON public.supplier_products;
CREATE TRIGGER trg_supplier_products_enqueue_video_transcode
AFTER INSERT OR UPDATE ON public.supplier_products
FOR EACH ROW EXECUTE FUNCTION public.enqueue_video_transcode_job();

-- 4) Optional RLS posture: keep direct table access denied to regular users.
ALTER TABLE public.video_transcode_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role only read/write transcode jobs" ON public.video_transcode_jobs;
CREATE POLICY "Service role only read/write transcode jobs"
ON public.video_transcode_jobs
AS PERMISSIVE
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
