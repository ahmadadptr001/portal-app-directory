-- ============================================================
-- MIGRASI 07 — Field katalog publik (slug, visibilitas, profil aplikasi)
-- Database : MySQL / Laragon (MySQL 8.0+)
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
--
-- CATATAN VISIBILITAS (penting):
--   `is_public` sengaja DEFAULT FALSE — aman secara default, supaya
--   aplikasi baru tidak pernah bocor ke publik tanpa keputusan sadar.
--   Baris yang SUDAH ADA di-backfill TRUE bila ia produksi & sehat
--   (env='production' AND status IN ('active','maintenance')), karena
--   itulah yang memang sudah layak tampil.
--   Backfill itu dikurung di penjagaan "kolom baru dibuat" supaya
--   menjalankan migrasi ini dua kali TIDAK menghidupkan kembali aplikasi
--   yang sengaja disembunyikan admin.
--
-- CATATAN IDEMPOTENSI MySQL:
--   MySQL 8.0 TIDAK punya `ADD COLUMN IF NOT EXISTS` maupun
--   `CREATE UNIQUE INDEX IF NOT EXISTS` (itu fitur MariaDB/PostgreSQL).
--   Menjalankan ALTER dua kali akan gagal "Duplicate column name".
--   Jadi setiap perubahan struktur dijaga dengan pemeriksaan
--   `information_schema` + SQL dinamis (PREPARE/EXECUTE) — pola yang
--   sama seperti migrations/mysql/01_seed_dummy_data.sql. `DO 0` dipakai
--   sebagai pernyataan tanpa efek bila perubahan sudah ada.
--
-- Catatan paritas: bagian realtime (publikasi supabase_realtime) adalah
--   fitur Supabase-only; di MySQL sinkronisasi mengandalkan polling klien,
--   jadi tidak ada langkah publikasi di sini.
--
-- Aman dijalankan berulang (idempotent).
--
-- KONVENSI: dipasangkan dengan
--   migrations/supabase/07_add_public_catalog_fields.sql
-- Jalankan di phpMyAdmin / MySQL CLI SETELAH migrasi 06.
-- ============================================================

-- ------------------------------------------------------------
-- 1. KOLOM BARU DI `apps`
--    Satu blok penjagaan per kolom. Verbose, tapi inilah satu-satunya
--    cara yang benar-benar idempotent di MySQL 8.0.
-- ------------------------------------------------------------

-- slug
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'apps' AND COLUMN_NAME = 'slug') = 0,
  'ALTER TABLE apps ADD COLUMN slug VARCHAR(220) NULL',
  'DO 0'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- logo_url
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'apps' AND COLUMN_NAME = 'logo_url') = 0,
  'ALTER TABLE apps ADD COLUMN logo_url TEXT NULL',
  'DO 0'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- go_live_date
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'apps' AND COLUMN_NAME = 'go_live_date') = 0,
  'ALTER TABLE apps ADD COLUMN go_live_date DATE NULL',
  'DO 0'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contact_name
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'apps' AND COLUMN_NAME = 'contact_name') = 0,
  'ALTER TABLE apps ADD COLUMN contact_name VARCHAR(100) NULL',
  'DO 0'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contact_email
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'apps' AND COLUMN_NAME = 'contact_email') = 0,
  'ALTER TABLE apps ADD COLUMN contact_email VARCHAR(150) NULL',
  'DO 0'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contact_phone
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'apps' AND COLUMN_NAME = 'contact_phone') = 0,
  'ALTER TABLE apps ADD COLUMN contact_phone VARCHAR(30) NULL',
  'DO 0'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ------------------------------------------------------------
-- 2. BACKFILL SLUG
--    Aturan dibuat SAMA PERSIS dengan versi Supabase: huruf kecil,
--    karakter non-alfanumerik menjadi '-', '-' berlebih dirapikan,
--    slug kosong menjadi 'aplikasi', dan SETIAP slug kembar diberi
--    imbuhan id aplikasi.
--
--    (Versi ROW_NUMBER() sengaja dihindari: hasilnya akan berbeda
--     antara MySQL dan PostgreSQL, dan itu melanggar paritas skema.)
--
--    2a idempotent lewat `WHERE slug IS NULL`; 2b konvergen — setelah
--    sekali jalan tidak ada lagi slug kembar.
-- ------------------------------------------------------------

-- 2a. Slug dasar dari nama
UPDATE apps
SET slug = COALESCE(
  NULLIF(TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER(name), '[^a-z0-9]+', '-')), ''),
  'aplikasi'
)
WHERE slug IS NULL;

-- 2b. Bubuhkan id pada slug yang bertabrakan.
--     Sub-query dibungkus derived table: MySQL menolak UPDATE yang
--     membaca tabel yang sama secara langsung (error 1093), dan derived
--     table ber-GROUP BY dipaksa dimaterialisasi lebih dulu.
UPDATE apps a
JOIN (
  SELECT slug FROM (
    SELECT slug FROM apps
    WHERE slug IS NOT NULL
    GROUP BY slug
    HAVING COUNT(*) > 1
  ) AS dup
) AS d ON a.slug = d.slug
SET a.slug = CONCAT(a.slug, '-', a.id);

-- Indeks UNIQUE dipasang SETELAH backfill, supaya baris lama tidak
-- menabrak constraint saat slug-nya masih NULL.
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'apps' AND INDEX_NAME = 'idx_apps_slug') = 0,
  'CREATE UNIQUE INDEX idx_apps_slug ON apps(slug)',
  'DO 0'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ------------------------------------------------------------
-- 3. VISIBILITAS PUBLIK
--    Status "kolom belum ada" direkam LEBIH DULU ke @is_public_baru,
--    supaya backfill di bawahnya berjalan TEPAT SEKALI
--    (lihat CATATAN VISIBILITAS di atas).
-- ------------------------------------------------------------
SET @is_public_baru := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'apps' AND COLUMN_NAME = 'is_public'
) = 0;

SET @sql := IF(@is_public_baru,
  'ALTER TABLE apps ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT FALSE',
  'DO 0'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(@is_public_baru,
  'UPDATE apps SET is_public = TRUE WHERE env = ''production'' AND status IN (''active'', ''maintenance'')',
  'DO 0'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'apps' AND INDEX_NAME = 'idx_apps_is_public') = 0,
  'CREATE INDEX idx_apps_is_public ON apps(is_public)',
  'DO 0'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ------------------------------------------------------------
-- 4. TABEL APP_SCREENSHOTS
--    Tabel anak, bukan kolom array/JSON: PostgreSQL punya TEXT[] tapi
--    MySQL tidak, dan konvensi proyek menuntut alur yang sama persis di
--    kedua database. Jadi screenshot mengikuti pola `app_tech`
--    (hapus-semua lalu tulis-ulang saat aplikasi disunting).
--
--    Catatan AUTO_INCREMENT: tabel ini dibuat kosong dan tidak pernah
--    menerima INSERT dengan id eksplisit, jadi tidak perlu disinkronkan.
--    (Gotcha di CLAUDE.md hanya berlaku untuk migrasi yang memasukkan
--     baris dengan id eksplisit.)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_screenshots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  app_id INT NOT NULL,
  url TEXT NOT NULL,
  caption VARCHAR(200) NULL,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_screenshot_app FOREIGN KEY (app_id)
    REFERENCES apps(id) ON DELETE CASCADE,
  INDEX idx_app_screenshots_app (app_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- VERIFIKASI
-- ============================================================
-- Kolom baru sudah ada?
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'apps'
  AND COLUMN_NAME IN ('slug', 'is_public', 'logo_url', 'go_live_date',
                      'contact_name', 'contact_email', 'contact_phone')
ORDER BY COLUMN_NAME;

-- Slug terisi semua & unik?
SELECT COUNT(*) AS total_apps,
       COUNT(slug) AS total_slug,
       COUNT(DISTINCT slug) AS slug_unik
FROM apps;

-- Aplikasi mana yang kini publik?
SELECT id, name, slug, env, status, is_public FROM apps ORDER BY id;

SELECT COUNT(*) AS total_screenshots FROM app_screenshots;
