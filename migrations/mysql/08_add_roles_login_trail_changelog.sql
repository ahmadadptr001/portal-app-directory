-- ============================================================
-- MIGRASI 08 — Tier 3: peran admin, jejak login, changelog aplikasi
-- Database : MySQL / Laragon (MySQL 8.0+)
--
-- Latar belakang, isi, dan catatan privasi/peran: SAMA PERSIS dengan
--   migrations/supabase/08_add_roles_login_trail_changelog.sql
-- (alamat IP hanya disimpan sebagai hash — UU PDP No. 27/2022; admin
--  dengan id terkecil menjadi superadmin; backfill hanya sekali).
--
-- CATATAN IDEMPOTENSI MySQL:
--   MySQL 8.0 tidak punya `ADD COLUMN IF NOT EXISTS` maupun
--   `CREATE INDEX IF NOT EXISTS`, jadi setiap perubahan struktur dijaga
--   dengan pemeriksaan `information_schema` + SQL dinamis
--   (PREPARE/EXECUTE, no-op `DO 0`) — pola yang sama seperti migrasi 07.
--
-- Catatan paritas: bagian realtime (publikasi supabase_realtime) adalah
--   fitur Supabase-only; di MySQL sinkronisasi mengandalkan polling klien.
--
-- Aman dijalankan berulang (idempotent).
--
-- KONVENSI: dipasangkan dengan
--   migrations/supabase/08_add_roles_login_trail_changelog.sql
-- Jalankan di phpMyAdmin / MySQL CLI SETELAH migrasi 07.
-- ============================================================

-- ------------------------------------------------------------
-- 1. PERAN ADMIN
--    superadmin | admin | viewer
--    Status "kolom belum ada" direkam LEBIH DULU supaya backfill
--    berjalan tepat sekali.
-- ------------------------------------------------------------
SET @role_baru := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'admins' AND COLUMN_NAME = 'role'
) = 0;

SET @sql := IF(@role_baru,
  'ALTER TABLE admins ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT ''admin''',
  'DO 0'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Akun pertama menjadi superadmin. Sub-query dibungkus derived table:
-- MySQL menolak UPDATE yang membaca tabel yang sama secara langsung (1093).
SET @sql := IF(@role_baru,
  'UPDATE admins SET role = ''superadmin'' WHERE id = (SELECT id FROM (SELECT MIN(id) AS id FROM admins) AS t)',
  'DO 0'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- CHECK constraint (MySQL 8.0.16+ menegakkannya).
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'admins'
     AND CONSTRAINT_NAME = 'admins_role_check') = 0,
  'ALTER TABLE admins ADD CONSTRAINT admins_role_check CHECK (role IN (''superadmin'', ''admin'', ''viewer''))',
  'DO 0'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ------------------------------------------------------------
-- 2. METADATA SESI
-- ------------------------------------------------------------
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'user_agent') = 0,
  'ALTER TABLE sessions ADD COLUMN user_agent TEXT NULL',
  'DO 0'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'ip_hash') = 0,
  'ALTER TABLE sessions ADD COLUMN ip_hash VARCHAR(64) NULL',
  'DO 0'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'last_seen_at') = 0,
  'ALTER TABLE sessions ADD COLUMN last_seen_at TIMESTAMP NULL',
  'DO 0'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ------------------------------------------------------------
-- 3. JEJAK LOGIN
--    Mencatat percobaan BERHASIL dan GAGAL; yang gagal adalah tanda
--    percobaan masuk paksa. `admin_id` boleh NULL agar percobaan dengan
--    username tak dikenal tetap tercatat.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS login_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT NULL,
  username_attempt VARCHAR(50) NOT NULL,
  success BOOLEAN NOT NULL,
  reason VARCHAR(50) NULL,
  ip_hash VARCHAR(64) NULL,
  user_agent TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_login_logs_admin FOREIGN KEY (admin_id)
    REFERENCES admins(id) ON DELETE SET NULL,
  INDEX idx_login_logs_created (created_at),
  INDEX idx_login_logs_username (username_attempt),
  INDEX idx_login_logs_success (success)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 4. CHANGELOG APLIKASI
--    kind: feature | fix | security | other
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_changelogs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  app_id INT NOT NULL,
  version VARCHAR(50) NOT NULL,
  released_at DATE NULL,
  kind VARCHAR(20) NOT NULL DEFAULT 'other',
  notes TEXT NULL,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_changelog_app FOREIGN KEY (app_id)
    REFERENCES apps(id) ON DELETE CASCADE,
  CONSTRAINT app_changelogs_kind_check
    CHECK (kind IN ('feature', 'fix', 'security', 'other')),
  INDEX idx_app_changelogs_app (app_id, released_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- VERIFIKASI
-- ============================================================
SELECT id, username, role FROM admins ORDER BY id;

SELECT COLUMN_NAME, COLUMN_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sessions'
  AND COLUMN_NAME IN ('user_agent', 'ip_hash', 'last_seen_at')
ORDER BY COLUMN_NAME;

SELECT COUNT(*) AS total_login_logs FROM login_logs;
SELECT COUNT(*) AS total_changelogs FROM app_changelogs;
