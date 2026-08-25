-- ============================================================
-- MIGRASI 07 — Field katalog publik (slug, visibilitas, profil aplikasi)
-- Database : PostgreSQL / Supabase
--
-- Latar belakang:
--   Portal akan membuka katalog publik tanpa login (/katalog). Untuk itu
--   setiap aplikasi butuh (a) URL yang stabil & enak dibagikan, (b) penanda
--   tegas apakah ia boleh tampil publik, dan (c) data profil yang membuat
--   halaman detailnya layak dibaca warga: logo, screenshot, tanggal
--   go-live, dan kontak pengelola.
--
-- Isi:
--   1. Kolom baru di `apps`: slug, is_public, logo_url, go_live_date,
--      contact_name, contact_email, contact_phone
--   2. Backfill slug dari nama + indeks UNIQUE
--   3. Backfill is_public (SEKALI SAJA — lihat catatan di bawah)
--   4. Tabel `app_screenshots` (pola tabel anak, seperti `app_tech`)
--   5. Daftarkan `app_screenshots` ke publikasi realtime
--
-- CATATAN VISIBILITAS (penting):
--   `is_public` sengaja DEFAULT FALSE — aman secara default, supaya
--   aplikasi baru tidak pernah bocor ke publik tanpa keputusan sadar.
--   Baris yang SUDAH ADA di-backfill TRUE bila ia produksi & sehat
--   (env='production' AND status IN ('active','maintenance')), karena
--   itulah yang memang sudah layak tampil.
--   Backfill itu dikurung di dalam cabang "kolom baru dibuat" supaya
--   menjalankan migrasi ini dua kali TIDAK menghidupkan kembali aplikasi
--   yang sengaja disembunyikan admin.
--
-- Aman dijalankan berulang (idempotent).
--
-- KONVENSI: dipasangkan dengan
--   migrations/mysql/07_add_public_catalog_fields.sql
-- Jalankan via Supabase SQL Editor SETELAH migrasi 06.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. KOLOM BARU DI `apps`
--    PostgreSQL punya ADD COLUMN IF NOT EXISTS, jadi cukup satu baris
--    per kolom. (Padanan MySQL-nya jauh lebih panjang — lihat file MySQL.)
-- ------------------------------------------------------------
ALTER TABLE apps ADD COLUMN IF NOT EXISTS slug          VARCHAR(220);
ALTER TABLE apps ADD COLUMN IF NOT EXISTS logo_url      TEXT;
ALTER TABLE apps ADD COLUMN IF NOT EXISTS go_live_date  DATE;
ALTER TABLE apps ADD COLUMN IF NOT EXISTS contact_name  VARCHAR(100);
ALTER TABLE apps ADD COLUMN IF NOT EXISTS contact_email VARCHAR(150);
ALTER TABLE apps ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(30);

-- ------------------------------------------------------------
-- 2. BACKFILL SLUG
--    Dibuat dari `name`: huruf kecil, karakter non-alfanumerik menjadi
--    '-', tanda '-' berlebih dirapikan. Nama yang menghasilkan slug
--    kosong (mis. berisi simbol saja) memakai 'aplikasi'.
--
--    Aturan tabrakan: SETIAP baris yang slug-nya kembar diberi imbuhan
--    id aplikasi — id dijamin unik, jadi tabrakan tidak mungkin tersisa.
--    Aturan ini dipilih karena bisa ditulis sama persis di MySQL;
--    versi ROW_NUMBER() akan menghasilkan slug yang BERBEDA antara
--    PostgreSQL dan MySQL, dan itu melanggar paritas skema.
--
--    `WHERE slug IS NULL` membuat langkah 2a idempotent: slug yang sudah
--    ada (termasuk yang diubah manual admin) tidak pernah disentuh.
--    Langkah 2b konvergen — setelah dijalankan sekali tidak ada lagi
--    slug kembar, jadi pemanggilan berikutnya tidak melakukan apa pun.
-- ------------------------------------------------------------
-- 2a. Slug dasar dari nama
UPDATE apps
SET slug = COALESCE(
  NULLIF(trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')), ''),
  'aplikasi'
)
WHERE slug IS NULL;

-- 2b. Bubuhkan id pada slug yang bertabrakan
UPDATE apps a
SET slug = a.slug || '-' || a.id
WHERE a.slug IN (
  SELECT slug FROM apps WHERE slug IS NOT NULL GROUP BY slug HAVING COUNT(*) > 1
);

-- Indeks UNIQUE dipasang SETELAH backfill, supaya baris lama tidak
-- menabrak constraint saat slug-nya masih NULL.
CREATE UNIQUE INDEX IF NOT EXISTS idx_apps_slug ON apps(slug);

-- ------------------------------------------------------------
-- 3. VISIBILITAS PUBLIK
--    Kolom + backfill disatukan dalam satu penjagaan supaya backfill
--    berjalan TEPAT SEKALI (lihat CATATAN VISIBILITAS di atas).
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'apps' AND column_name = 'is_public'
  ) THEN
    ALTER TABLE apps ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT FALSE;

    UPDATE apps
    SET is_public = TRUE
    WHERE env = 'production'
      AND status IN ('active', 'maintenance');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_apps_is_public ON apps(is_public);

-- ------------------------------------------------------------
-- 4. TABEL APP_SCREENSHOTS
--    Tabel anak, bukan kolom array/JSON: PostgreSQL punya TEXT[] tapi
--    MySQL tidak, dan konvensi proyek menuntut alur yang sama persis di
--    kedua database. Jadi screenshot mengikuti pola `app_tech`
--    (hapus-semua lalu tulis-ulang saat aplikasi disunting).
--
--    Catatan sequence: tabel ini dibuat kosong dan tidak pernah menerima
--    INSERT dengan id eksplisit, jadi sequence-nya tidak perlu
--    disinkronkan. (Gotcha setval di CLAUDE.md hanya berlaku untuk
--    migrasi yang memasukkan id eksplisit — dan `setval(seq, 0, true)`
--    pada tabel kosong justru error "out of bounds".)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_screenshots (
  id SERIAL PRIMARY KEY,
  app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  caption VARCHAR(200),
  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_screenshots_app ON app_screenshots(app_id, sort_order);

ALTER TABLE app_screenshots ENABLE ROW LEVEL SECURITY;

-- Policy idempotent: hanya dibuat bila belum ada.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'app_screenshots' AND policyname = 'Service role only'
  ) THEN
    EXECUTE 'CREATE POLICY "Service role only" ON app_screenshots FOR ALL USING (auth.role() = ''service_role'')';
  END IF;
END $$;

-- ------------------------------------------------------------
-- 5. REALTIME — daftarkan tabel ke publikasi supabase_realtime
--    (idempotent: hanya menambah bila belum terdaftar)
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'app_screenshots'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE app_screenshots;
    END IF;
  END IF;
END $$;

COMMIT;

-- ============================================================
-- VERIFIKASI
-- ============================================================
-- Kolom baru sudah ada?
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'apps'
  AND column_name IN ('slug', 'is_public', 'logo_url', 'go_live_date',
                      'contact_name', 'contact_email', 'contact_phone')
ORDER BY column_name;

-- Slug terisi semua & unik?
SELECT COUNT(*) AS total_apps,
       COUNT(slug) AS total_slug,
       COUNT(DISTINCT slug) AS slug_unik
FROM apps;

-- Aplikasi mana yang kini publik?
SELECT id, name, slug, env, status, is_public FROM apps ORDER BY id;

SELECT COUNT(*) AS total_screenshots FROM app_screenshots;
