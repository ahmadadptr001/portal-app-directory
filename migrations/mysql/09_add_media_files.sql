-- ============================================================
-- MIGRASI 09 — Registri media (media_files)
-- Database : MySQL / Laragon (MySQL 8.0+)
--
-- Latar belakang, isi, dan konvensi kolom: SAMA PERSIS dengan
--   migrations/supabase/09_add_media_files.sql
-- (buku besar aset gambar: satu baris per URL, pembeda berkas kelolaan
--  portal vs URL eksternal, dasar pembersihan storage saat data dihapus.)
--
-- Catatan deploy MySQL: unggahan baru disimpan sebagai BERKAS LOKAL di
--   <proyek>/public/uploads/apps/ (driver 'local') — Next.js menyajikannya
--   langsung dari folder public, jadi tidak butuh layanan storage tambahan.
--
-- Aman dijalankan berulang (idempotent).
-- KONVENSI: dipasangkan dengan migrations/supabase/09_add_media_files.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS media_files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  url TEXT NOT NULL,
  path TEXT NULL,
  driver VARCHAR(20) NOT NULL DEFAULT 'external',
  mime VARCHAR(50) NULL,
  size_bytes INT NULL,
  uploaded_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_media_files_url (url(255)),
  CONSTRAINT fk_media_admin FOREIGN KEY (uploaded_by)
    REFERENCES admins(id) ON DELETE SET NULL,
  INDEX idx_media_files_created (created_at),
  INDEX idx_media_files_driver (driver)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- BACKFILL — URL yang sudah ada di apps & app_screenshots
-- (INSERT IGNORE = idempoten terhadap UNIQUE url)
-- ------------------------------------------------------------
INSERT IGNORE INTO media_files (url, driver)
SELECT DISTINCT logo_url, 'external'
FROM apps
WHERE logo_url IS NOT NULL;

INSERT IGNORE INTO media_files (url, driver)
SELECT DISTINCT s.url, 'external'
FROM app_screenshots s
WHERE s.url IS NOT NULL;

-- ============================================================
-- VERIFIKASI
-- ============================================================
SELECT driver, COUNT(*) AS total FROM media_files GROUP BY driver ORDER BY driver;
