-- ================================================================
-- Singapore F&B Portal — Complete Database Setup v3.0
-- Combines: schema + migration (username/avatar) + seed data
--
-- ✅ Safe to run on a brand-new project
-- ✅ Safe to re-run on an existing project (fully idempotent)
--
-- How to run:
--   Supabase Dashboard → SQL Editor → New query → Paste → Run
-- ================================================================

-- ──────────────────────────────────────────────────────────────
-- 1. TABLES
-- ──────────────────────────────────────────────────────────────

-- Profiles (extends Supabase Auth users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid        REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email       text        NOT NULL,
  name        text        NOT NULL DEFAULT '',
  username    text        UNIQUE,
  avatar_url  text        DEFAULT '',
  role        text        NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  whatsapp    text        DEFAULT '',
  company     text        DEFAULT '',
  created_at  timestamptz DEFAULT now(),
  banned      boolean     DEFAULT false
);
-- Add new columns if the table already existed without them
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username   text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text DEFAULT '';
-- Unique index on username (NULLs are not considered duplicates)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique
  ON public.profiles (username) WHERE username IS NOT NULL;

-- Suppliers
CREATE TABLE IF NOT EXISTS public.suppliers (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  slug            text        UNIQUE NOT NULL,
  name            text        NOT NULL,
  name_ja         text        NOT NULL,
  logo            text        DEFAULT '',
  category        text        NOT NULL,
  category_ja     text        DEFAULT '',
  tags            text[]      DEFAULT '{}',
  area            text        NOT NULL,
  area_ja         text        DEFAULT '',
  description     text        DEFAULT '',
  description_ja  text        DEFAULT '',
  whatsapp        text        DEFAULT '',
  views           integer     DEFAULT 0,
  certifications  text[]      DEFAULT '{}',
  about           text        DEFAULT '',
  featured        boolean     DEFAULT false,
  plan            text        NOT NULL DEFAULT 'basic' CHECK (plan IN ('basic','standard','premium')),
  plan_expires_at timestamptz,
  created_at      timestamptz DEFAULT now()
);
-- Add plan columns if table already existed without them
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS plan            text NOT NULL DEFAULT 'basic' CHECK (plan IN ('basic','standard','premium'));
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz;
-- Up to 3 categories, catalog URL, extra images, WhatsApp contact name
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS category_2      text DEFAULT '';
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS category_2_ja   text DEFAULT '';
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS category_3      text DEFAULT '';
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS category_3_ja   text DEFAULT '';
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS catalog_url     text DEFAULT '';
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS image_2         text DEFAULT '';
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS image_3         text DEFAULT '';
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS whatsapp_contact_name text DEFAULT '';
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS about_ja             text DEFAULT '';

-- Supplier Products
CREATE TABLE IF NOT EXISTS public.supplier_products (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id uuid REFERENCES public.suppliers ON DELETE CASCADE NOT NULL,
  name        text NOT NULL,
  image       text DEFAULT '',
  moq         text DEFAULT ''
);

-- Marketplace Items
CREATE TABLE IF NOT EXISTS public.marketplace_items (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  slug             text        UNIQUE NOT NULL,
  title            text        NOT NULL,
  price            numeric     NOT NULL DEFAULT 0,
  image            text        DEFAULT '',
  images           text[]      DEFAULT '{}',
  area             text        DEFAULT '',
  condition        text        DEFAULT '',
  years_used       integer     DEFAULT 0,
  description      text        DEFAULT '',
  category         text        DEFAULT '',
  seller_id        uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  seller_name      text        DEFAULT '',
  seller_whatsapp  text        DEFAULT '',
  created_at       timestamptz DEFAULT now(),
  status           text        DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  delivery         text        DEFAULT '',
  reject_reason    text
);
-- Bilingual columns for EN/JA display
ALTER TABLE public.marketplace_items ADD COLUMN IF NOT EXISTS title_en       text DEFAULT '';
ALTER TABLE public.marketplace_items ADD COLUMN IF NOT EXISTS area_en        text DEFAULT '';
ALTER TABLE public.marketplace_items ADD COLUMN IF NOT EXISTS condition_en   text DEFAULT '';
ALTER TABLE public.marketplace_items ADD COLUMN IF NOT EXISTS description_en text DEFAULT '';
ALTER TABLE public.marketplace_items ADD COLUMN IF NOT EXISTS delivery_en    text DEFAULT '';

-- News Articles
CREATE TABLE IF NOT EXISTS public.news_articles (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  slug         text        UNIQUE NOT NULL,
  title        text        NOT NULL,
  title_ja     text        DEFAULT '',
  excerpt      text        DEFAULT '',
  excerpt_ja   text        DEFAULT '',
  content      text        DEFAULT '',
  content_ja   text        DEFAULT '',
  image        text        DEFAULT '',
  category     text        DEFAULT '',
  author       text        DEFAULT '',
  published    boolean     DEFAULT false,
  published_at timestamptz,
  created_at   timestamptz DEFAULT now()
);
ALTER TABLE public.news_articles ADD COLUMN IF NOT EXISTS published_at timestamptz;

-- Categories
CREATE TABLE IF NOT EXISTS public.categories (
  id         uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  type       text    NOT NULL DEFAULT 'supplier',
  value      text    NOT NULL,
  label      text    NOT NULL,
  label_ja   text    DEFAULT '',
  sort_order integer DEFAULT 0
);
-- Allow tag type alongside existing types
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_type_check;
-- Add label_ja if the table already exists without it
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS label_ja text DEFAULT '';

-- Site Settings (key-value store)
CREATE TABLE IF NOT EXISTS public.site_settings (
  key   text PRIMARY KEY,
  value text NOT NULL DEFAULT ''
);

-- Reports
CREATE TABLE IF NOT EXISTS public.reports (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  item_type   text        NOT NULL CHECK (item_type IN ('marketplace_item','supplier')),
  item_id     uuid        NOT NULL,
  reporter_id uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason      text        NOT NULL,
  status      text        DEFAULT 'pending' CHECK (status IN ('pending','reviewed','dismissed')),
  created_at  timestamptz DEFAULT now()
);

-- ── Page Views (site-wide monthly traffic) ─────────────────────
-- Each row = one page load. Aggregate by month in queries.
CREATE TABLE IF NOT EXISTS public.page_views (
  id         bigserial   PRIMARY KEY,
  path       text        NOT NULL DEFAULT '/',
  visited_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS page_views_visited_at_idx ON public.page_views (visited_at);

-- ── Supplier View Logs (monthly per-supplier stats) ─────────────
-- Logged alongside the existing suppliers.views counter.
CREATE TABLE IF NOT EXISTS public.supplier_view_logs (
  id          bigserial   PRIMARY KEY,
  supplier_id uuid        REFERENCES public.suppliers(id) ON DELETE CASCADE NOT NULL,
  viewed_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS supplier_view_logs_supplier_id_idx  ON public.supplier_view_logs (supplier_id);
CREATE INDEX IF NOT EXISTS supplier_view_logs_viewed_at_idx    ON public.supplier_view_logs (viewed_at);

-- ──────────────────────────────────────────────────────────────
-- 2. ROW LEVEL SECURITY — enable on every table
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_views           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_view_logs   ENABLE ROW LEVEL SECURITY;
-- Add extra product detail columns (safe to run multiple times)
ALTER TABLE public.supplier_products ADD COLUMN IF NOT EXISTS name_en           text DEFAULT '';
ALTER TABLE public.supplier_products ADD COLUMN IF NOT EXISTS country_of_origin text DEFAULT '';
ALTER TABLE public.supplier_products ADD COLUMN IF NOT EXISTS weight            text DEFAULT '';
ALTER TABLE public.supplier_products ADD COLUMN IF NOT EXISTS quantity          text DEFAULT '';
ALTER TABLE public.supplier_products ADD COLUMN IF NOT EXISTS storage_condition text DEFAULT '';
ALTER TABLE public.supplier_products ADD COLUMN IF NOT EXISTS temperature       text DEFAULT '';
-- Video URL: direct MP4/WebM upload URL or YouTube / Vimeo embed URL
ALTER TABLE public.supplier_products ADD COLUMN IF NOT EXISTS video_url         text DEFAULT '';

ALTER TABLE public.supplier_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_articles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports           ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────────────────────
-- 3. RLS POLICIES (drop first → idempotent re-run)
-- ──────────────────────────────────────────────────────────────

-- profiles
DROP POLICY IF EXISTS "Public read"      ON public.profiles;
DROP POLICY IF EXISTS "Users insert own" ON public.profiles;
DROP POLICY IF EXISTS "Users update own" ON public.profiles;
CREATE POLICY "Public read"      ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users insert own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- suppliers
DROP POLICY IF EXISTS "Public read" ON public.suppliers;
DROP POLICY IF EXISTS "Admin full"  ON public.suppliers;
CREATE POLICY "Public read" ON public.suppliers FOR SELECT USING (true);
CREATE POLICY "Admin full"  ON public.suppliers FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- supplier_products
DROP POLICY IF EXISTS "Public read" ON public.supplier_products;
DROP POLICY IF EXISTS "Admin full"  ON public.supplier_products;
CREATE POLICY "Public read" ON public.supplier_products FOR SELECT USING (true);
CREATE POLICY "Admin full"  ON public.supplier_products FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- marketplace_items
DROP POLICY IF EXISTS "Public read approved" ON public.marketplace_items;
DROP POLICY IF EXISTS "Users insert own"     ON public.marketplace_items;
DROP POLICY IF EXISTS "Users update own"     ON public.marketplace_items;
DROP POLICY IF EXISTS "Users delete own"     ON public.marketplace_items;
CREATE POLICY "Public read approved" ON public.marketplace_items FOR SELECT USING (
  status = 'approved' OR seller_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Users insert own" ON public.marketplace_items FOR INSERT
  WITH CHECK (seller_id = auth.uid());
CREATE POLICY "Users update own" ON public.marketplace_items FOR UPDATE USING (
  seller_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Users delete own" ON public.marketplace_items FOR DELETE USING (
  seller_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- news_articles
DROP POLICY IF EXISTS "Public read published" ON public.news_articles;
DROP POLICY IF EXISTS "Admin full"            ON public.news_articles;
CREATE POLICY "Public read published" ON public.news_articles FOR SELECT USING (
  published = true OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admin full" ON public.news_articles FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- categories
DROP POLICY IF EXISTS "Public read" ON public.categories;
DROP POLICY IF EXISTS "Admin full"  ON public.categories;
CREATE POLICY "Public read" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Admin full"  ON public.categories FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- site_settings
DROP POLICY IF EXISTS "Public read" ON public.site_settings;
DROP POLICY IF EXISTS "Admin full"  ON public.site_settings;
CREATE POLICY "Public read" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "Admin full"  ON public.site_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- reports
DROP POLICY IF EXISTS "Users insert" ON public.reports;
DROP POLICY IF EXISTS "Admin read"   ON public.reports;
DROP POLICY IF EXISTS "Admin update" ON public.reports;
CREATE POLICY "Users insert" ON public.reports FOR INSERT WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "Admin read"   ON public.reports FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admin update" ON public.reports FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- page_views: anyone can insert (anon hits count), only admin can read
DROP POLICY IF EXISTS "Anon insert" ON public.page_views;
DROP POLICY IF EXISTS "Admin read"  ON public.page_views;
CREATE POLICY "Anon insert" ON public.page_views FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin read"  ON public.page_views FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- supplier_view_logs: anyone can insert, only admin can read
DROP POLICY IF EXISTS "Anon insert" ON public.supplier_view_logs;
DROP POLICY IF EXISTS "Admin read"  ON public.supplier_view_logs;
CREATE POLICY "Anon insert" ON public.supplier_view_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin read"  ON public.supplier_view_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ──────────────────────────────────────────────────────────────
-- 4. FUNCTION + TRIGGER — auto-create profile on signup
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, username, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    NEW.raw_user_meta_data->>'username',
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    name       = COALESCE(EXCLUDED.name,       public.profiles.name),
    username   = COALESCE(EXCLUDED.username,   public.profiles.username),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ──────────────────────────────────────────────────────────────
-- 5. STORAGE — avatars bucket + policies
-- ──────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars', 'avatars', true, 5242880,
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Avatar public read"           ON storage.objects;
DROP POLICY IF EXISTS "Avatar authenticated upload"  ON storage.objects;
DROP POLICY IF EXISTS "Avatar owner update"          ON storage.objects;
DROP POLICY IF EXISTS "Avatar owner delete"          ON storage.objects;

CREATE POLICY "Avatar public read"
  ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Avatar authenticated upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);
CREATE POLICY "Avatar owner update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Avatar owner delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Logos bucket (for supplier logos; upload via API with service role)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'logos', 'logos', true, 5242880,
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO UPDATE SET public = true;
DROP POLICY IF EXISTS "Logos public read" ON storage.objects;
CREATE POLICY "Logos public read"
  ON storage.objects FOR SELECT USING (bucket_id = 'logos');

-- ──────────────────────────────────────────────────────────────
-- 6. SEED — settings & categories
-- ──────────────────────────────────────────────────────────────
INSERT INTO public.site_settings (key, value) VALUES
  ('qr_redirect_url',  '/suppliers'),
  ('banner_title',     'シンガポールF&Bポータルへようこそ'),
  ('banner_subtitle',  '信頼できるサプライヤーを見つけましょう'),
  ('daily_post_limit', '5'),
  ('areas', '[{"value":"central","label":"中央エリア"},{"value":"east","label":"東部エリア"},{"value":"west","label":"西部エリア"},{"value":"north","label":"北部エリア"},{"value":"south","label":"南部エリア"}]')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO public.categories (type, value, label, sort_order) VALUES
  ('supplier',     'seafood',           '海鮮・鮮魚',  1),
  ('supplier',     'meat',              '肉類',        2),
  ('supplier',     'vegetables',        '野菜・青果',  3),
  ('supplier',     'dairy',             '乳製品',      4),
  ('supplier',     'dry-goods',         '乾物・調味料',5),
  ('supplier',     'beverages',         '飲料・酒類',  6),
  ('supplier',     'equipment',         '厨房機器',    7),
  ('supplier',     'packaging',         '包装・容器',  8),
  ('marketplace',  'kitchen-equipment', '厨房機器',    1),
  ('marketplace',  'tableware',         '食器・備品',  2),
  ('marketplace',  'tools',             '調理器具',    3),
  ('marketplace',  'furniture',         '家具',        4),
  ('marketplace',  'other',             'その他',      5),
  ('news',         'industry',          '業界ニュース',1),
  ('news',         'regulation',        '規制・法律',  2),
  ('news',         'trend',             'トレンド',    3),
  ('news',         'event',             'イベント',    4)
ON CONFLICT DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- 7. SEED — suppliers
-- ──────────────────────────────────────────────────────────────
INSERT INTO public.suppliers
  (id, slug, name, name_ja, logo, category, category_ja,
   tags, area, area_ja, description, description_ja,
   whatsapp, views, certifications, about, featured, plan)
VALUES
  (
    'a1000000-0000-0000-0000-000000000001',
    'tokyo-seafood', 'Tokyo Seafood Co.', '東京シーフード株式会社',
    'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=200&h=200&fit=crop',
    'seafood', '海鮮・鮮魚',
    ARRAY['少量対応','日本語対応','ハラール'],
    'central', '中央エリア',
    'Premium seafood supplier with daily fresh catches',
    '毎日新鮮な魚介類を提供する高品質シーフードサプライヤー。築地から直送。',
    '6512345678', 1250, ARRAY['HACCP','ISO 22000','ハラール認証'],
    '2005年創業。シンガポールの日本料理店を中心に、最高品質の鮮魚を毎日お届けしています。築地市場との直接取引により、常に新鮮な商品をご提供いたします。',
    true, 'premium'
  ),
  (
    'a1000000-0000-0000-0000-000000000002',
    'green-harvest', 'Green Harvest Pte Ltd', 'グリーンハーベスト',
    'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=200&h=200&fit=crop',
    'vegetables', '野菜・青果',
    ARRAY['少量対応','オーガニック'],
    'north', '北部エリア',
    'Organic vegetables and herbs supplier',
    'オーガニック野菜とハーブの専門サプライヤー。地元農園から新鮮直送。',
    '6523456789', 980, ARRAY['有機JAS','GlobalGAP'],
    'シンガポール北部の自社農園で栽培したオーガニック野菜を、レストランやカフェに直接お届けしています。',
    false, 'standard'
  ),
  (
    'a1000000-0000-0000-0000-000000000003',
    'asia-meat-supply', 'Asia Meat Supply', 'アジアミートサプライ',
    'https://images.unsplash.com/photo-1588347818036-558601350947?w=200&h=200&fit=crop',
    'meat', '肉類',
    ARRAY['ハラール','大量注文可','翌日配送'],
    'west', '西部エリア',
    'Halal certified meat supplier',
    'ハラール認証済み。和牛からチキンまで幅広い肉類を取り扱い。',
    '6534567890', 1500, ARRAY['ハラール認証','HACCP'],
    'アジア各国から厳選した肉類を、シンガポール全土のレストランにお届けしています。ハラール認証取得済み。',
    true, 'premium'
  ),
  (
    'a1000000-0000-0000-0000-000000000004',
    'sakura-beverages', 'Sakura Beverages', 'さくらビバレッジ',
    'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=200&h=200&fit=crop',
    'beverages', '飲料・酒類',
    ARRAY['日本語対応','少量対応','日本酒専門'],
    'central', '中央エリア',
    'Japanese sake and beverages specialist',
    '日本酒・焼酎を中心とした飲料の専門卸。蔵元直送の希少銘柄も取扱。',
    '6545678901', 870, ARRAY['酒類販売免許'],
    '日本全国の蔵元と直接取引し、シンガポールの日本料理店に最高品質の日本酒をお届けしています。',
    false, 'standard'
  ),
  (
    'a1000000-0000-0000-0000-000000000005',
    'pacific-dry-goods', 'Pacific Dry Goods', 'パシフィック乾物',
    'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=200&h=200&fit=crop',
    'dry-goods', '乾物・調味料',
    ARRAY['少量対応','日本語対応'],
    'east', '東部エリア',
    'Japanese condiments and dry goods',
    '味噌、醤油、だし等の和食調味料と乾物を幅広く取り扱い。',
    '6556789012', 720, ARRAY['食品衛生管理者'],
    '日本の伝統的な調味料と乾物を専門に取り扱う卸売業者です。シンガポール在住の日本人シェフに愛用されています。',
    false, 'basic'
  ),
  (
    'a1000000-0000-0000-0000-000000000006',
    'kitchen-pro-equipment', 'Kitchen Pro Equipment', 'キッチンプロ機器',
    'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=200&h=200&fit=crop',
    'equipment', '厨房機器',
    ARRAY['設置サポート','メンテナンス対応'],
    'south', '南部エリア',
    'Commercial kitchen equipment supplier',
    '業務用厨房機器の販売・設置・メンテナンスまでワンストップで対応。',
    '6567890123', 650, ARRAY['ISO 9001'],
    'シンガポール全土のレストラン・ホテルに業務用厨房機器を提供しています。設置からアフターメンテナンスまで一貫サポート。',
    false, 'basic'
  )
ON CONFLICT (slug) DO UPDATE SET
  views    = EXCLUDED.views,
  featured = EXCLUDED.featured,
  plan     = EXCLUDED.plan;

-- ──────────────────────────────────────────────────────────────
-- 8. SEED — supplier products (with Country of Origin, Weight, Quantity, Storage Condition, Temperature)
-- ──────────────────────────────────────────────────────────────
INSERT INTO public.supplier_products (supplier_id, name, name_en, image, moq, country_of_origin, weight, quantity, storage_condition, temperature)
SELECT s.id, p.name, p.name_en, p.image, p.moq, p.country_of_origin, p.weight, p.quantity, p.storage_condition, p.temperature
FROM (VALUES
  ('tokyo-seafood',        'マグロ（本マグロ）',       'Bluefin Tuna',           'https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?w=400&h=300&fit=crop', '1kg〜', 'Japan',           '1kg〜', '1kg per portion',  'Frozen at -18°C',     'Frozen'),
  ('tokyo-seafood',        'サーモン（ノルウェー産）', 'Norwegian Salmon',       'https://images.unsplash.com/photo-1599084993091-1cb5c0721cc6?w=400&h=300&fit=crop', '2kg〜', 'Norway',          '2kg〜', '2kg per fillet',    'Chilled 0-4°C',      'Chilled'),
  ('tokyo-seafood',        'エビ（ブラックタイガー）', 'Black Tiger Shrimp',     'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=400&h=300&fit=crop', '1kg〜', 'Thailand',         '1kg〜', '1kg per box',       'Frozen at -18°C',     'Frozen'),
  ('green-harvest',        '有機レタスミックス',       'Organic Lettuce Mix',    'https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?w=400&h=300&fit=crop', '500g〜', 'Singapore',       '500g〜', '500g per bag',      'Refrigerated 2-5°C', 'Fresh'),
  ('green-harvest',        'フレッシュハーブセット',   'Fresh Herb Set',         'https://images.unsplash.com/photo-1515586000433-45406d8e6662?w=400&h=300&fit=crop', '100g〜', 'Singapore',       '100g〜', '100g per bunch',    'Refrigerated 2-5°C', 'Fresh'),
  ('asia-meat-supply',     'A5和牛サーロイン',         'A5 Wagyu Sirloin',       'https://images.unsplash.com/photo-1615937722923-67f6deaf2cc9?w=400&h=300&fit=crop', '500g〜', 'Japan',           '500g〜', '500g per cut',      'Frozen at -18°C',     'Frozen'),
  ('asia-meat-supply',     'ハラールチキン',           'Halal Chicken',          'https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=400&h=300&fit=crop', '2kg〜', 'Malaysia',         '2kg〜', '2kg per pack',      'Chilled 0-4°C',      'Chilled'),
  ('sakura-beverages',     '純米大吟醸セット',         'Junmai Daiginjo Set',    'https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?w=400&h=300&fit=crop', '6本〜', 'Japan',           '720ml×6', '6 bottles',         'Room temperature',   'Fresh'),
  ('pacific-dry-goods',    '有機醤油（1L）',           'Organic Soy Sauce (1L)', 'https://images.unsplash.com/photo-1585672840563-f2af2ced55c9?w=400&h=300&fit=crop', '6本〜', 'Japan',           '1L', '6 bottles',          'Room temperature',   'Fresh'),
  ('pacific-dry-goods',    '信州味噌',                 'Shinshu Miso',           'https://images.unsplash.com/photo-1614563637806-1d0e645e0940?w=400&h=300&fit=crop', '1kg〜', 'Japan',           '1kg', '1kg per tub',       'Refrigerated after opening', 'Fresh'),
  ('kitchen-pro-equipment','業務用冷蔵庫',             'Commercial Refrigerator','https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?w=400&h=300&fit=crop', '1台〜', 'Singapore',       'N/A', '1 unit',            'Indoor installation', 'Chilled')
) AS p(slug, name, name_en, image, moq, country_of_origin, weight, quantity, storage_condition, temperature)
JOIN public.suppliers s ON s.slug = p.slug
WHERE NOT EXISTS (
  SELECT 1 FROM public.supplier_products sp WHERE sp.supplier_id = s.id AND sp.name = p.name
);

-- Backfill existing supplier_products rows with product details (for DBs that already had old seed data)
UPDATE public.supplier_products sp SET
  name_en = v.name_en,
  country_of_origin = v.country_of_origin,
  weight = v.weight,
  quantity = v.quantity,
  storage_condition = v.storage_condition,
  temperature = v.temperature
FROM (
  SELECT s.id AS supplier_id, p.name, p.name_en, p.country_of_origin, p.weight, p.quantity, p.storage_condition, p.temperature
  FROM (VALUES
    ('tokyo-seafood',        'マグロ（本マグロ）',       'Bluefin Tuna',           'Japan',           '1kg〜', '1kg per portion',  'Frozen at -18°C',     'Frozen'),
    ('tokyo-seafood',        'サーモン（ノルウェー産）', 'Norwegian Salmon',       'Norway',          '2kg〜', '2kg per fillet',    'Chilled 0-4°C',      'Chilled'),
    ('tokyo-seafood',        'エビ（ブラックタイガー）', 'Black Tiger Shrimp',     'Thailand',         '1kg〜', '1kg per box',       'Frozen at -18°C',     'Frozen'),
    ('green-harvest',        '有機レタスミックス',       'Organic Lettuce Mix',    'Singapore',       '500g〜', '500g per bag',      'Refrigerated 2-5°C', 'Fresh'),
    ('green-harvest',        'フレッシュハーブセット',   'Fresh Herb Set',         'Singapore',       '100g〜', '100g per bunch',    'Refrigerated 2-5°C', 'Fresh'),
    ('asia-meat-supply',     'A5和牛サーロイン',         'A5 Wagyu Sirloin',       'Japan',           '500g〜', '500g per cut',      'Frozen at -18°C',     'Frozen'),
    ('asia-meat-supply',     'ハラールチキン',           'Halal Chicken',          'Malaysia',         '2kg〜', '2kg per pack',      'Chilled 0-4°C',      'Chilled'),
    ('sakura-beverages',     '純米大吟醸セット',         'Junmai Daiginjo Set',    'Japan',           '720ml×6', '6 bottles',         'Room temperature',   'Fresh'),
    ('pacific-dry-goods',    '有機醤油（1L）',           'Organic Soy Sauce (1L)', 'Japan',           '1L', '6 bottles',          'Room temperature',   'Fresh'),
    ('pacific-dry-goods',    '信州味噌',                 'Shinshu Miso',           'Japan',           '1kg', '1kg per tub',       'Refrigerated after opening', 'Fresh'),
    ('kitchen-pro-equipment','業務用冷蔵庫',             'Commercial Refrigerator','Singapore',       'N/A', '1 unit',            'Indoor installation', 'Chilled')
  ) AS p(slug, name, name_en, country_of_origin, weight, quantity, storage_condition, temperature)
  JOIN public.suppliers s ON s.slug = p.slug
) v
WHERE sp.supplier_id = v.supplier_id AND sp.name = v.name;

-- ──────────────────────────────────────────────────────────────
-- 9. SEED — marketplace items (~30 items, bilingual EN/JA)
-- ──────────────────────────────────────────────────────────────
INSERT INTO public.marketplace_items
  (slug, title, title_en, price, image, images, area, area_en, condition, condition_en,
   years_used, description, description_en, category, seller_id, seller_name, seller_whatsapp,
   created_at, status, delivery, delivery_en)
VALUES
  ('commercial-oven-used','業務用コンベクションオーブン','Commercial convection oven',2500,
   'https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?w=600&h=450&fit=crop',
   ARRAY['https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?w=800&h=600&fit=crop','https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=600&fit=crop'],
   '中央エリア','Central','良好','Good',2,'閉店のため出品。まだまだ使えます。定期メンテナンス済み。即日引き取り可能。','Listed due to store closure. Still in great working condition. Regularly maintained. Available for immediate pickup.',
   '厨房機器',NULL,'田中シェフ','6512345678','2024-01-15 00:00:00+00','approved','引き取りのみ','Pickup only'),
  ('sushi-counter-set','寿司カウンターセット（檜製）','Sushi counter set (cypress wood)',4800,
   'https://images.unsplash.com/photo-1553621042-f6e147245754?w=600&h=450&fit=crop',
   ARRAY['https://images.unsplash.com/photo-1553621042-f6e147245754?w=800&h=600&fit=crop'],
   '東部エリア','East','良好','Good',3,'檜の寿司カウンター。8席分。移転のためお譲りします。','Hinoki cypress sushi counter seating 8 guests. Selling due to relocation.',
   '厨房機器',NULL,'佐藤','6523456789','2024-01-12 00:00:00+00','approved','配送可能','Delivery available'),
  ('ramen-bowls-set','ラーメン丼セット（50個）','Ramen bowl set (50 pcs)',350,
   'https://images.unsplash.com/photo-1557872943-16a5ac26437e?w=600&h=450&fit=crop',
   ARRAY['https://images.unsplash.com/photo-1557872943-16a5ac26437e?w=800&h=600&fit=crop'],
   '西部エリア','West','新品同様','Like new',0,'未使用のラーメン丼50個セット。メニュー変更のため出品。','Set of 50 unused ramen bowls. Listed due to menu change.',
   '食器・備品',NULL,'鈴木','6534567890','2024-01-10 00:00:00+00','approved','引き取り・配送可','Pickup or delivery'),
  ('ice-cream-machine','業務用アイスクリームマシン','Commercial ice cream machine',1800,
   'https://images.unsplash.com/photo-1567206563064-6f60f40a2b57?w=600&h=450&fit=crop',
   ARRAY['https://images.unsplash.com/photo-1567206563064-6f60f40a2b57?w=800&h=600&fit=crop'],
   '北部エリア','North','使用感あり','Used',4,'まだ動作します。メンテナンス記録あり。','Still functional. Maintenance records available.',
   '厨房機器',NULL,'山田','6545678901','2024-01-08 00:00:00+00','approved','引き取りのみ','Pickup only'),
  ('chef-knives-set','包丁セット（堺製）5本','Chef knife set (Sakai) 5 pcs',890,
   'https://images.unsplash.com/photo-1593618998160-e34014e67546?w=600&h=450&fit=crop',
   ARRAY['https://images.unsplash.com/photo-1593618998160-e34014e67546?w=800&h=600&fit=crop'],
   '中央エリア','Central','良好','Good',1,'堺の職人が作った和包丁5本セット。出刃、柳刃、薄刃、菜切、牛刀。','Set of 5 Japanese knives handcrafted in Sakai. Includes deba, yanagiba, usuba, nakiri, and gyuto.',
   '調理器具',NULL,'高橋シェフ','6556789012','2024-01-05 00:00:00+00','approved','配送可能','Delivery available'),
  ('restaurant-tables','レストランテーブル4台セット','Restaurant table set (4 tables)',600,
   'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&h=450&fit=crop',
   ARRAY['https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=600&fit=crop'],
   '南部エリア','South','良好','Good',2,'4人掛けテーブル4台。木製天板、鉄脚。店舗改装のため出品。','Set of 4 four-person dining tables. Wooden tops, iron legs. Selling due to store renovation.',
   '家具',NULL,'中村','6567890123','2024-01-03 00:00:00+00','approved','引き取りのみ','Pickup only'),
  ('gooseneck-kettle','グースネック電気ケトル','Gooseneck electric kettle',45,
   'https://images.unsplash.com/photo-1556679343-c7306c7916f2?w=600&h=450&fit=crop',
   ARRAY['https://images.unsplash.com/photo-1556679343-c7306c7916f2?w=800&h=600&fit=crop'],
   '中央エリア','Central','使用感あり','Used',1,'おしゃれカフェ用。温度調節付き。引き取りのみ。','Used for specialty café. Temperature control included. Pickup only.',
   '調理器具',NULL,'小林','6578901234','2024-02-01 00:00:00+00','approved','引き取りのみ','Pickup only'),
  ('cast-iron-dutch-oven','鋳物製ダッチオーブン（オレンジ）','Cast iron Dutch oven (orange)',120,
   'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&h=450&fit=crop',
   ARRAY['https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&h=600&fit=crop'],
   '東部エリア','East','新品同様','Like new',0,'5.5L、未使用。店舗開業キャンセルのため出品。','5.5L capacity, unused. Listed due to cancelled store opening.',
   '調理器具',NULL,'伊藤','6589012345','2024-02-02 00:00:00+00','approved','引き取り・配送可','Pickup or delivery'),
  ('commercial-refrigerator','業務用冷蔵庫（2ドア）','Commercial refrigerator (2-door)',1500,
   'https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?w=600&h=450&fit=crop',
   ARRAY['https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?w=800&h=600&fit=crop'],
   '西部エリア','West','使用感あり','Used',5,'生鮮・冷凍食材用。動作良好。自取のみ。','For fresh and frozen produce. Good working order. Pickup only.',
   '厨房機器',NULL,'渡辺','6590123456','2024-02-03 00:00:00+00','approved','引き取りのみ','Pickup only'),
  ('display-refrigerator','デザート・ケーキ用ショーケース','Display refrigerator for desserts & cakes',2200,
   'https://images.unsplash.com/photo-1559847844-531f7766403e?w=600&h=450&fit=crop',
   ARRAY['https://images.unsplash.com/photo-1559847844-531f7766403e?w=800&h=600&fit=crop'],
   '北部エリア','North','良好','Good',2,'パティスリー閉店のため。LEDライト付き、ガラス扉。','From closed patisserie. LED lighting, glass doors.',
   '厨房機器',NULL,'加藤','6501234567','2024-02-05 00:00:00+00','approved','配送可能','Delivery available'),
  ('commercial-espresso-machine','業務用エスプレッソマシン（2グループ）','Commercial espresso machine (2-group)',3200,
   'https://images.unsplash.com/photo-1495474473077-e9738a2e46e9?w=600&h=450&fit=crop',
   ARRAY['https://images.unsplash.com/photo-1495474473077-e9738a2e46e9?w=800&h=600&fit=crop'],
   '中央エリア','Central','良好','Good',3,'イタリア製。定期メンテナンス済み。即日引き取り可能。','Italian-made. Regularly serviced. Available for immediate pickup.',
   '厨房機器',NULL,'田中シェフ','6512345678','2024-02-06 00:00:00+00','approved','引き取りのみ','Pickup only'),
  ('commercial-blender','業務用ミキサー（2L）','Commercial blender (2L)',280,
   'https://images.unsplash.com/photo-1570222098062-7d247613b7c6?w=600&h=450&fit=crop',
   ARRAY['https://images.unsplash.com/photo-1570222098062-7d247613b7c6?w=800&h=600&fit=crop'],
   '南部エリア','South','新品同様','Like new',0,'スムージー・ジュース用。試し切りで出品。','For smoothies and juices. Selling after trial use.',
   '厨房機器',NULL,'佐藤','6523456789','2024-02-08 00:00:00+00','approved','引き取り・配送可','Pickup or delivery'),
  ('large-rice-cooker','炊飯器（30合・業務用）','Large rice cooker (30-cup, commercial)',450,
   'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&h=450&fit=crop',
   ARRAY['https://images.unsplash.com/photo-1586201375761-83865001e31c?w=800&h=600&fit=crop'],
   '東部エリア','East','良好','Good',2,'日本製。炊き上がりタイマー付き。和食店閉店に伴い出品。','Japanese-made. Cooked rice timer included. Selling due to Japanese restaurant closure.',
   '厨房機器',NULL,'鈴木','6534567890','2024-02-10 00:00:00+00','approved','配送可能','Delivery available'),
  ('commercial-wok','中華鍋（業務用・直径60cm）','Commercial wok (60cm diameter)',180,
   'https://images.unsplash.com/photo-1534939561126-855b8675edd7?w=600&h=450&fit=crop',
   ARRAY['https://images.unsplash.com/photo-1534939561126-855b8675edd7?w=800&h=600&fit=crop'],
   '西部エリア','West','使用感あり','Used',4,'炭火・ガス兼用。チャーハン・炒め物に最適。','Charcoal and gas compatible. Ideal for fried rice and stir-fries.',
   '調理器具',NULL,'山田','6545678901','2024-02-12 00:00:00+00','approved','引き取りのみ','Pickup only'),
  ('prep-table-stainless','ステンレス調理台（作業台）','Stainless steel prep table',350,
   'https://images.unsplash.com/photo-1556911220-bff31c812dba?w=600&h=450&fit=crop',
   ARRAY['https://images.unsplash.com/photo-1556911220-bff31c812dba?w=800&h=600&fit=crop'],
   '北部エリア','North','良好','Good',1,'180cm×60cm。棚付き。清掃済み。','180cm × 60cm. With shelves. Thoroughly cleaned.',
   '厨房機器',NULL,'高橋シェフ','6556789012','2024-02-14 00:00:00+00','approved','配送可能','Delivery available'),
  ('bar-stools-set','バースツール4脚セット','Bar stools set (4 pcs)',320,
   'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=600&h=450&fit=crop',
   ARRAY['https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800&h=600&fit=crop'],
   '中央エリア','Central','新品同様','Like new',0,'金属フレーム、木製座面。カフェ・バー用。','Metal frame, wooden seats. For café or bar.',
   '家具',NULL,'中村','6567890123','2024-02-16 00:00:00+00','approved','引き取り・配送可','Pickup or delivery'),
  ('wine-cooler','ワインクーラー（業務用）','Wine cooler (commercial)',780,
   'https://images.unsplash.com/photo-1510812431401-41d2e9c25b2e?w=600&h=450&fit=crop',
   ARRAY['https://images.unsplash.com/photo-1510812431401-41d2e9c25b2e?w=800&h=600&fit=crop'],
   '東部エリア','East','良好','Good',2,'約50本収納。温度調節可能。居酒屋閉店のため。','Holds ~50 bottles. Adjustable temperature. From closed izakaya.',
   '厨房機器',NULL,'小林','6578901234','2024-02-18 00:00:00+00','approved','引き取りのみ','Pickup only'),
  ('commercial-dishwasher','業務用食洗機（パススルー型）','Commercial dishwasher (pass-through)',2800,
   'https://images.unsplash.com/photo-1581579438747-1dc8d17bbce4?w=600&h=450&fit=crop',
   ARRAY['https://images.unsplash.com/photo-1581579438747-1dc8d17bbce4?w=800&h=600&fit=crop'],
   '西部エリア','West','使用感あり','Used',6,'高さ調節ラック付き。動作良好。自取限定。','Adjustable height racks. Good working order. Pickup only.',
   '厨房機器',NULL,'伊藤','6589012345','2024-02-20 00:00:00+00','approved','引き取りのみ','Pickup only'),
  ('stand-mixer','業務用スタンドミキサー（20L）','Stand mixer (20L, commercial)',650,
   'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&h=450&fit=crop',
   ARRAY['https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&h=600&fit=crop'],
   '南部エリア','South','新品同様','Like new',0,'パン・生地用。附屬ボウル・フック付き。','For bread and dough. Includes bowl and hook attachments.',
   '厨房機器',NULL,'渡辺','6590123456','2024-02-22 00:00:00+00','approved','配送可能','Delivery available'),
  ('chafing-dishes-set','シーフィングディッシュセット（6個）','Chafing dishes set (6 pcs)',220,
   'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&h=450&fit=crop',
   ARRAY['https://images.unsplash.com/photo-1544025162-d76694265947?w=800&h=600&fit=crop'],
   '北部エリア','North','良好','Good',1,'ビュッフェ・宴会用。燃料皿・蓋付き。','For buffet and events. Includes fuel trays and lids.',
   '食器・備品',NULL,'加藤','6501234567','2024-02-24 00:00:00+00','approved','引き取り・配送可','Pickup or delivery'),
  ('commercial-fryer','業務用フライヤー（2槽）','Commercial fryer (2-basket)',950,
   'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&h=450&fit=crop',
   ARRAY['https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=600&fit=crop'],
   '中央エリア','Central','使用感あり','Used',3,'温度調節付き。油交換済み。引き取りのみ。','Temperature control. Oil recently changed. Pickup only.',
   '厨房機器',NULL,'田中シェフ','6512345678','2024-02-26 00:00:00+00','approved','引き取りのみ','Pickup only'),
  ('pizza-oven','ピザ窯（石窯タイプ）','Pizza oven (stone type)',1200,
   'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&h=450&fit=crop',
   ARRAY['https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&h=600&fit=crop'],
   '東部エリア','East','良好','Good',2,'窯内温度400℃対応。移動可能。ピザ店閉店のため。','Up to 400°C. Portable. From closed pizza shop.',
   '厨房機器',NULL,'佐藤','6523456789','2024-02-28 00:00:00+00','approved','配送可能','Delivery available'),
  ('chopping-boards-set','まな板セット（業務用・5枚）','Cutting board set (commercial, 5 pcs)',85,
   'https://images.unsplash.com/photo-1594221708779-94832f4320d1?w=600&h=450&fit=crop',
   ARRAY['https://images.unsplash.com/photo-1594221708779-94832f4320d1?w=800&h=600&fit=crop'],
   '西部エリア','West','新品同様','Like new',0,'プラスチック製、色分け済み。衛生管理に最適。','Plastic, colour-coded. Ideal for food safety compliance.',
   '調理器具',NULL,'鈴木','6534567890','2024-03-01 00:00:00+00','approved','引き取り・配送可','Pickup or delivery'),
  ('bento-boxes-bulk','弁当容器・蓋付き（100個）','Bento boxes with lids (100 pcs)',75,
   'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&h=450&fit=crop',
   ARRAY['https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&h=600&fit=crop'],
   '北部エリア','North','新品','New',0,'耐熱・電子レンジ対応。テイクアウト店用。','Heat-resistant, microwave-safe. For takeaway shops.',
   '包装・容器',NULL,'山田','6545678901','2024-03-02 00:00:00+00','approved','配送可能','Delivery available'),
  ('sushi-plates-set','寿司皿セット（檜風・30枚）','Sushi plate set (30 pcs, wood-style)',180,
   'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=600&h=450&fit=crop',
   ARRAY['https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800&h=600&fit=crop'],
   '南部エリア','South','良好','Good',1,'和風デザイン。洗いやすい素材。','Japanese-style design. Easy to wash.',
   '食器・備品',NULL,'高橋シェフ','6556789012','2024-03-03 00:00:00+00','approved','配送可能','Delivery available'),
  ('serving-trays-metal','メタルサーブトレイ（大・10枚）','Metal serving trays (large, 10 pcs)',95,
   'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&h=450&fit=crop',
   ARRAY['https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=600&fit=crop'],
   '中央エリア','Central','使用感あり','Used',2,'ステンレス製。ホテル・レストラン用。','Stainless steel. For hotels and restaurants.',
   '食器・備品',NULL,'中村','6567890123','2024-03-04 00:00:00+00','approved','引き取り・配送可','Pickup or delivery'),
  ('exhaust-hood','厨房用排煙フード','Commercial exhaust hood',1500,
   'https://images.unsplash.com/photo-1556911220-bff31c812dba?w=600&h=450&fit=crop',
   ARRAY['https://images.unsplash.com/photo-1556911220-bff31c812dba?w=800&h=600&fit=crop'],
   '東部エリア','East','使用感あり','Used',5,'幅2m。フィルター清掃済み。設置サポート別途相談可。','2m width. Filters cleaned. Installation support available on request.',
   '厨房機器',NULL,'小林','6578901234','2024-03-05 00:00:00+00','approved','引き取りのみ','Pickup only'),
  ('small-kettle','ケトル（小型・シンプル）','Kettle (small, simple)',15,
   'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=600&h=450&fit=crop',
   ARRAY['https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=800&h=600&fit=crop'],
   '西部エリア','West','使用感あり','Used',2,'スタッフ休憩室用。1.5L。即納可。','For staff break room. 1.5L. Ready for immediate pickup.',
   '調理器具',NULL,'伊藤','6589012345','2024-03-06 00:00:00+00','approved','引き取り・配送可','Pickup or delivery'),
  ('outdoor-dining-set','屋外用ダイニングセット（4人用）','Outdoor dining set (4-person)',480,
   'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&h=450&fit=crop',
   ARRAY['https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=600&fit=crop'],
   '北部エリア','North','良好','Good',1,'テーブル＋椅子4脚。アルミフレーム、耐候性あり。','Table and 4 chairs. Aluminium frame, weather-resistant.',
   '家具',NULL,'渡辺','6590123456','2024-03-07 00:00:00+00','approved','配送可能','Delivery available'),
  ('soup-pots-set','業務用スープ鍋セット（3個）','Commercial soup pot set (3 pcs)',150,
   'https://images.unsplash.com/photo-1548688977-3e38ddc590f6?w=600&h=450&fit=crop',
   ARRAY['https://images.unsplash.com/photo-1548688977-3e38ddc590f6?w=800&h=600&fit=crop'],
   '南部エリア','South','良好','Good',1,'12L・8L・5L。ステンレス製。ラーメン・カレー用。','12L, 8L, 5L. Stainless steel. For ramen and curry.',
   '調理器具',NULL,'加藤','6501234567','2024-03-08 00:00:00+00','approved','引き取り・配送可','Pickup or delivery')
ON CONFLICT (slug) DO UPDATE SET
  title=EXCLUDED.title, title_en=EXCLUDED.title_en,
  area=EXCLUDED.area, area_en=EXCLUDED.area_en,
  condition=EXCLUDED.condition, condition_en=EXCLUDED.condition_en,
  description=EXCLUDED.description, description_en=EXCLUDED.description_en,
  delivery=EXCLUDED.delivery, delivery_en=EXCLUDED.delivery_en,
  status=EXCLUDED.status, price=EXCLUDED.price, image=EXCLUDED.image, images=EXCLUDED.images;

-- Force-overwrite all English fields with correct translations (runs unconditionally)
UPDATE public.marketplace_items SET area_en = CASE area
  WHEN '中央エリア' THEN 'Central' WHEN '東部エリア' THEN 'East' WHEN '西部エリア' THEN 'West'
  WHEN '北部エリア' THEN 'North' WHEN '南部エリア' THEN 'South' ELSE area_en END;
UPDATE public.marketplace_items SET condition_en = CASE condition
  WHEN '新品同様' THEN 'Like New' WHEN '新品' THEN 'New' WHEN '良好' THEN 'Good'
  WHEN '使用感あり' THEN 'Used' WHEN '要修理' THEN 'Needs Repair' ELSE condition_en END;
UPDATE public.marketplace_items SET delivery_en = CASE delivery
  WHEN '引き取りのみ' THEN 'Pickup only' WHEN '配送可能' THEN 'Delivery available'
  WHEN '引き取り・配送可' THEN 'Pickup or delivery' ELSE delivery_en END;

-- ──────────────────────────────────────────────────────────────
-- 10. SEED — news articles (10 items)
-- ──────────────────────────────────────────────────────────────
INSERT INTO public.news_articles
  (slug, title, title_ja, excerpt, excerpt_ja, content, content_ja,
   image, category, author, published, published_at)
VALUES
  (
    'singapore-fb-trends-2024',
    'Singapore F&B Industry Trends 2024',
    '2024年シンガポールF&B業界トレンド',
    'Key trends shaping Singapore food service in 2024.',
    '2024年のシンガポール外食産業を形成する主要トレンドを解説します。',
    'The Singapore F&B industry continues to evolve rapidly. Plant-based foods and sustainable sourcing are gaining traction across restaurants and cafes.',
    'シンガポールのF&B業界は急速に進化を続けています。日本料理の需要が高まる中、高品質な食材の安定供給が業界全体の課題となっています。特に2024年は植物性食品と持続可能な調達への関心が高まっています。',
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=450&fit=crop',
    'industry', '編集部', true, '2026-03-01 08:00:00+00'
  ),
  (
    'halal-certification-guide',
    'Halal Certification Guide for F&B Suppliers',
    'F&Bサプライヤーのためのハラール認証ガイド',
    'Everything you need to know about halal certification in Singapore.',
    'シンガポールでのハラール認証取得に関する完全ガイドです。',
    'Halal certification is essential for reaching Muslim consumers in Singapore. MUIS oversees halal certification and suppliers must meet specific standards.',
    'ハラール認証は、シンガポールのムスリム消費者にリーチするために不可欠です。シンガポールではMUISがハラール認証を管轄しており、取得には一定の基準を満たす必要があります。',
    'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&h=450&fit=crop',
    'regulation', '編集部', true, '2026-03-01 09:00:00+00'
  ),
  (
    'japanese-cuisine-demand-surge',
    'Surge in Japanese Cuisine Demand in Singapore',
    'シンガポールでの日本料理需要急増',
    'Japanese restaurant openings hit record numbers in Singapore.',
    'シンガポールでの日本料理レストランの開業が過去最高を記録しました。',
    'Demand for authentic Japanese cuisine is growing significantly. The first half of 2024 saw record new openings of Japanese restaurants.',
    'シンガポールでの本格的な日本料理への需要が急増しています。2024年上半期の日本料理レストランの新規開業数は過去最高を記録。和食食材の安定調達を求めるレストランオーナーからの問い合わせも増加しています。',
    'https://images.unsplash.com/photo-1553621042-f6e147245754?w=800&h=450&fit=crop',
    'trend', '編集部', true, '2026-03-01 10:00:00+00'
  ),
  (
    'plant-based-food-trend-singapore-2025',
    'Plant-Based Food Market Surges in Singapore',
    'シンガポールでプラントベース食品市場が急成長',
    'Singapore''s plant-based food sector is seeing record growth, with new local brands and international players entering the market.',
    'シンガポールのプラントベース食品セクターは記録的な成長を見せています。',
    'Singapore''s plant-based food sector is seeing record growth. New local brands and international players are entering the market.',
    'シンガポールのプラントベース食品セクターは記録的な成長を見せており、新しいローカルブランドや国際的な企業が市場に参入しています。',
    'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=450&fit=crop',
    'trend', '編集部', true, '2026-02-28 09:00:00+00'
  ),
  (
    'sfa-food-safety-regulations-2025',
    'Singapore Introduces Stricter Food Safety Regulations for 2025',
    'シンガポール、2025年に向けて食品安全規制を強化',
    'The Singapore Food Agency (SFA) has announced a new set of food safety regulations set to take effect in Q2 2025.',
    'シンガポール食品庁（SFA）は2025年第2四半期から施行される新たな食品安全規制を発表しました。',
    'The SFA has announced new food safety regulations impacting all F&B establishments.',
    'シンガポール食品庁は全F&B施設に影響する新たな食品安全規制を発表しました。',
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=450&fit=crop',
    'regulation', '編集部', true, '2026-02-25 08:00:00+00'
  ),
  (
    'restaurant-association-gala-2025',
    'RAS Annual Gala 2025: Celebrating Singapore''s F&B Industry',
    'RAS年次ガラ2025：シンガポールF&B業界を祝う',
    'The Restaurant Association of Singapore is hosting its annual gala dinner on March 15, recognising outstanding contributions.',
    'シンガポール・レストラン協会は3月15日に年次ガラディナーを開催します。',
    'The Restaurant Association of Singapore recognises outstanding contributions to the industry at its annual gala.',
    'シンガポール・レストラン協会は年次ガラで業界への優れた貢献を表彰します。',
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=450&fit=crop',
    'event', '編集部', true, '2026-02-22 10:00:00+00'
  ),
  (
    'seafood-supply-chain-sustainability',
    'Singapore''s Seafood Suppliers Embrace Sustainability Standards',
    'シンガポールの水産業者が持続可能性基準を採用',
    'Major seafood suppliers in Singapore are adopting new sustainability certifications.',
    'シンガポールの主要水産業者は新しい持続可能性認証を取得しています。',
    'Major seafood suppliers are adopting sustainability certifications as consumer demand for responsible sourcing grows.',
    '消費者の責任ある調達への需要の高まりに応え、主要水産業者が持続可能性認証を取得しています。',
    'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&h=450&fit=crop',
    'industry', '編集部', true, '2026-02-20 09:00:00+00'
  ),
  (
    'food-delivery-platform-changes-2025',
    'Food Delivery Platforms Update Commission Structures in Singapore',
    'フードデリバリープラットフォームがシンガポールの手数料体系を更新',
    'Major food delivery platforms have announced revised commission structures, affecting thousands of F&B businesses.',
    '主要フードデリバリープラットフォームが手数料体系の見直しを発表しました。',
    'Food delivery platforms have announced revised commission structures affecting thousands of F&B businesses.',
    'フードデリバリープラットフォームが数千のF&Bビジネスに影響を与える手数料体系の見直しを発表しました。',
    'https://images.unsplash.com/photo-1526367790999-0150786686a2?w=800&h=450&fit=crop',
    'industry', '編集部', true, '2026-02-18 08:00:00+00'
  ),
  (
    'singapore-food-festival-2025',
    'Singapore Food Festival 2025 Programme Unveiled',
    'シンガポール・フードフェスティバル2025のプログラムが発表',
    'The Singapore Tourism Board has unveiled the programme for Singapore Food Festival 2025, featuring over 50 events.',
    'シンガポール観光局がシンガポール・フードフェスティバル2025のプログラムを発表しました。',
    'The Singapore Tourism Board has unveiled the programme featuring over 50 events across the island.',
    'シンガポール観光局が島全体で50以上のイベントを予定するプログラムを発表しました。',
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=450&fit=crop',
    'event', '編集部', true, '2026-02-15 10:00:00+00'
  ),
  (
    'organic-produce-demand-restaurants',
    'Organic Produce Demand Rising Among Singapore Fine Dining Restaurants',
    'シンガポールの高級レストランでオーガニック食材の需要が上昇',
    'Fine dining establishments in Singapore are increasingly sourcing organic produce.',
    'シンガポールの高級飲食店がオーガニック食材の調達を増やしています。',
    'Fine dining establishments are increasingly sourcing organic produce, driving new supplier relationships.',
    '高級飲食店がオーガニック食材の調達を増やし、新たなサプライヤーとの関係を築いています。',
    'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&h=450&fit=crop',
    'trend', '編集部', true, '2026-02-12 09:00:00+00'
  )
ON CONFLICT (slug) DO UPDATE SET
  published_at = EXCLUDED.published_at,
  title = EXCLUDED.title,
  title_ja = EXCLUDED.title_ja,
  excerpt = EXCLUDED.excerpt,
  excerpt_ja = EXCLUDED.excerpt_ja,
  content = EXCLUDED.content,
  content_ja = EXCLUDED.content_ja,
  image = EXCLUDED.image,
  category = EXCLUDED.category,
  author = EXCLUDED.author,
  published = EXCLUDED.published;

-- ──────────────────────────────────────────────────────────────
-- 10b. AUDIT LOGS — Record of admin actions
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          bigserial   PRIMARY KEY,
  admin_id    uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  action      text        NOT NULL,
  target_type text        NOT NULL DEFAULT '',
  target_id   text        NOT NULL DEFAULT '',
  detail      text,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON public.audit_logs (created_at);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
-- Admins can read all log entries; inserts come from the service-role key (bypasses RLS)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'audit_logs' AND policyname = 'audit_logs_admin_read'
  ) THEN
    CREATE POLICY "audit_logs_admin_read" ON public.audit_logs
      FOR SELECT TO authenticated
      USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
      );
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────
-- 11. ADMIN USER SETUP
-- Confirms email + creates admin profile for Admin@gmail.com
-- (Create the user first: Supabase Dashboard → Auth → Users → Add user,
--  or register at /register with Admin@gmail.com and your password, then run this.)
-- Avatar: Japanese woman in her 20s (professional portrait).
-- ──────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_uid uuid;
  v_avatar text := 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&h=200&fit=crop&facepad=2';
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = 'Admin@gmail.com';

  IF v_uid IS NULL THEN
    RAISE NOTICE 'Admin user not found in auth.users. Create Admin@gmail.com in Dashboard (Auth → Users → Add user) or register at /register first, then re-run this script.';
  ELSE
    -- Confirm the email so login works without clicking an email link
    UPDATE auth.users
    SET
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      confirmation_token = '',
      updated_at         = now()
    WHERE id = v_uid;

    -- Create / update the profile with admin role and avatar (Japanese woman in her 20s)
    INSERT INTO public.profiles (id, email, name, username, avatar_url, role, whatsapp, company, banned)
    VALUES (v_uid, 'Admin@gmail.com', 'Admin', 'admin', v_avatar, 'admin', '', '', false)
    ON CONFLICT (id) DO UPDATE SET
      email     = 'Admin@gmail.com',
      name      = 'Admin',
      username  = 'admin',
      avatar_url = v_avatar,
      role      = 'admin';

    RAISE NOTICE 'Admin setup complete. User ID: %', v_uid;
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────
-- 12. VERIFY — row counts after setup
-- ──────────────────────────────────────────────────────────────
SELECT table_name, rows FROM (
  SELECT 'profiles'          AS table_name, COUNT(*) AS rows FROM public.profiles          UNION ALL
  SELECT 'suppliers',                       COUNT(*)         FROM public.suppliers          UNION ALL
  SELECT 'supplier_products',               COUNT(*)         FROM public.supplier_products  UNION ALL
  SELECT 'marketplace_items',               COUNT(*)         FROM public.marketplace_items  UNION ALL
  SELECT 'news_articles',                   COUNT(*)         FROM public.news_articles      UNION ALL
  SELECT 'categories',                      COUNT(*)         FROM public.categories         UNION ALL
  SELECT 'site_settings',                   COUNT(*)         FROM public.site_settings      UNION ALL
  SELECT 'reports',                         COUNT(*)         FROM public.reports
) t ORDER BY table_name;
ALTER TABLE public.supplier_products ADD COLUMN IF NOT EXISTS video_url  text DEFAULT '';
-- Product dimensions (W × D × H) — for refrigerators, POS terminals, equipment etc.
ALTER TABLE public.supplier_products ADD COLUMN IF NOT EXISTS size_w    text DEFAULT '';
ALTER TABLE public.supplier_products ADD COLUMN IF NOT EXISTS size_d    text DEFAULT '';
ALTER TABLE public.supplier_products ADD COLUMN IF NOT EXISTS size_h    text DEFAULT '';
ALTER TABLE public.supplier_products ADD COLUMN IF NOT EXISTS size_unit text DEFAULT 'cm';