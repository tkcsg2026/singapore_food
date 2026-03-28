-- ─────────────────────────────────────────────────────────────────────────────
-- supabase-videos-bucket.sql
--
-- Run this once in the Supabase SQL editor to create / fix the `videos` storage
-- bucket.  Safe to re-run — every statement is idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Create (or repair) the bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'videos', 'videos', true,
  209715200,           -- 200 MB
  ARRAY[
    'video/mp4','video/webm','video/quicktime','video/x-quicktime',
    'video/3gpp','video/3gpp2','video/x-msvideo','video/x-matroska',
    'video/mpeg','video/ogg','video/x-ms-wmv','video/x-flv',
    'video/mp2t','video/mxf','video/x-m4v',
    'application/octet-stream'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public             = true,
  file_size_limit    = 209715200,
  allowed_mime_types = ARRAY[
    'video/mp4','video/webm','video/quicktime','video/x-quicktime',
    'video/3gpp','video/3gpp2','video/x-msvideo','video/x-matroska',
    'video/mpeg','video/ogg','video/x-ms-wmv','video/x-flv',
    'video/mp2t','video/mxf','video/x-m4v',
    'application/octet-stream'
  ];

-- 2. Storage policies (drop-before-create for idempotency)
DROP POLICY IF EXISTS "Videos public read"    ON storage.objects;
DROP POLICY IF EXISTS "Videos service insert" ON storage.objects;
DROP POLICY IF EXISTS "Videos service update" ON storage.objects;
DROP POLICY IF EXISTS "Videos service delete" ON storage.objects;

-- Public read: anyone can stream/download
CREATE POLICY "Videos public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'videos');

-- Write / delete: open (upload is authenticated at the API / signed-URL layer)
CREATE POLICY "Videos service insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'videos');

CREATE POLICY "Videos service update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'videos');

CREATE POLICY "Videos service delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'videos');

-- 3. Verification query
SELECT
  b.id,
  b.name,
  b.public,
  pg_size_pretty(b.file_size_limit::bigint) AS max_size,
  array_length(b.allowed_mime_types, 1)     AS allowed_mime_count,
  COUNT(p.policyname)                       AS policy_count
FROM storage.buckets b
LEFT JOIN pg_policies p
  ON p.tablename = 'objects'
 AND p.policyname LIKE '%Videos%'
WHERE b.id = 'videos'
GROUP BY b.id, b.name, b.public, b.file_size_limit, b.allowed_mime_types;
