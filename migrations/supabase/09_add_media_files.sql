-- ============================================================
-- MIGRASI 09 — Registri media (media_files)
-- Database : PostgreSQL / Supabase
--
-- Latar belakang:
--   Sejak fitur unggah gambar, setiap berkas logo/screenshot tersimpan di
--   Supabase Storage (bucket app-media) atau disk lokal (deploy MySQL) dan
--   URL publiknya mengalir ke apps.logo_url / app_screenshots.url — tapi
--   TIDAK ADA catatan pusatnya. Akibatnya:
--     - tidak bisa membedakan berkas milik portal vs URL eksternal tempelan;
--     - penghapusan app tidak bisa membereskan berkas fisiknya di storage.
--   Tabel ini adalah buku besar aset: satu baris per URL gambar.
--
--   driver:
--     supabase → berkas di bucket app-media (boleh di-GC lewat storage API)
--     local    → berkas di public/uploads (deploy MySQL/Laragon)
--     external → URL tempelan manual dari luar (JANGAN PERNAH di-GC)
--
-- BACKFILL: seluruh URL yang sudah terpakai dimasukkan sebagai 'external'
--   supaya data lama langsung terlacak. Mereka tidak akan pernah dihapus
--   oleh pembersih berkas (bukan berkelola portal).
--
-- Aman dijalankan berulang (idempotent).
-- KONVENSI: dipasangkan dengan migrations/mysql/09_add_media_files.sql
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS media_files (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  path TEXT,
  driver VARCHAR(20) NOT NULL DEFAULT 'external',
  mime VARCHAR(50),
  size_bytes INTEGER,
  uploaded_by INTEGER REFERENCES admins(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_files_created ON media_files(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_files_driver ON media_files(driver);

ALTER TABLE media_files ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'media_files' AND policyname = 'Service role only'
  ) THEN
    EXECUTE 'CREATE POLICY "Service role only" ON media_files FOR ALL USING (auth.role() = ''service_role'')';
  END IF;
END $$;

-- ------------------------------------------------------------
-- BACKFILL — URL yang sudah ada di apps & app_screenshots
-- ------------------------------------------------------------
INSERT INTO media_files (url, driver)
SELECT DISTINCT logo_url, 'external'
FROM apps
WHERE logo_url IS NOT NULL
ON CONFLICT (url) DO NOTHING;

INSERT INTO media_files (url, driver)
SELECT DISTINCT s.url, 'external'
FROM app_screenshots s
WHERE s.url IS NOT NULL
ON CONFLICT (url) DO NOTHING;

COMMIT;

-- ============================================================
-- VERIFIKASI
-- ============================================================
SELECT driver, COUNT(*) FROM media_files GROUP BY driver ORDER BY driver;
