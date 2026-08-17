-- ============================================================
-- MIGRASI 06 — Tabel `activity_logs` (riwayat perubahan / audit trail)
-- Database : MySQL / Laragon (MySQL 8.0+)
--
-- Latar belakang:
--   Portal belum punya jejak audit: tidak ada catatan siapa yang
--   menambah/mengubah/menghapus data. Migrasi ini menambah tabel
--   `activity_logs` untuk keperluan profesionalitas & akuntabilitas.
--
-- Isi:
--   1. Buat tabel `activity_logs` (idempotent: IF NOT EXISTS)
--
-- Aman dijalankan berulang (idempotent): tabel yang sudah ada
-- tidak dibuat ulang.
--
-- Catatan paritas: realtime (SSE /api/realtime) adalah fitur
-- Supabase-only; di MySQL sinkronisasi mengandalkan polling klien,
-- jadi tidak ada langkah publikasi di sini.
--
-- KONVENSI: dipasangkan dengan
--   migrations/supabase/06_add_activity_logs.sql
-- Jalankan di phpMyAdmin / MySQL CLI.
-- ============================================================

-- ------------------------------------------------------------
-- 1. TABEL ACTIVITY_LOGS
--    action  : create | update | delete | import | reset
--    entity  : app | category | technology | system
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activity_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT NULL,
  admin_username VARCHAR(50) NOT NULL,
  action VARCHAR(20) NOT NULL,
  entity_type VARCHAR(20) NOT NULL,
  entity_name VARCHAR(200) NOT NULL,
  entity_id INT NULL,
  details TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_activity_admin FOREIGN KEY (admin_id)
    REFERENCES admins(id) ON DELETE SET NULL,
  INDEX idx_activity_logs_created (created_at),
  INDEX idx_activity_logs_entity (entity_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- VERIFIKASI
-- ============================================================
SELECT COUNT(*) AS total_logs FROM activity_logs;
SELECT COLUMN_NAME FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'activity_logs'
ORDER BY ORDINAL_POSITION;
