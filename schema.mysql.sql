-- ============================================================
-- Schema Portal Direktori Aplikasi — MySQL / Laragon
-- Jalankan di phpMyAdmin / MySQL CLI (MySQL 8.0+)
--
-- Versi portabel dari schema.sql (PostgreSQL/Supabase).
-- KEPUTUSAN ARSITEKTUR: auth memakai tabel kustom `admins`,
-- BUKAN Supabase auth.users — lihat juga schema.sql.
--
-- Catatan: MySQL tidak punya Row Level Security, jadi proteksi
-- akses data dikontrol di level aplikasi (session + role admin).
-- ============================================================

-- ============================================
-- HAPUS TABEL (jika ada) — urutan sesuai foreign key
-- ============================================
DROP TABLE IF EXISTS activity_logs;
DROP TABLE IF EXISTS login_logs;
DROP TABLE IF EXISTS app_changelogs;
DROP TABLE IF EXISTS app_screenshots;
DROP TABLE IF EXISTS app_tech;
DROP TABLE IF EXISTS apps;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS admins;

-- ============================================
-- TABEL ADMINS (auth kustom) — kolom role dari migrasi 08
--   superadmin : kelola akun & peran, cabut sesi, reset data
--   admin      : kelola aplikasi/kategori/teknologi/changelog
--   viewer     : hanya melihat
-- Akun PERTAMA sebaiknya di-promosikan superadmin (migrasi 08 melakukannya
-- otomatis untuk DB yang sudah ada; untuk instalasi baru jalankan:
--   UPDATE admins SET role = 'superadmin'
--   WHERE id = (SELECT id FROM (SELECT MIN(id) AS id FROM admins) AS t);
-- )
-- ============================================
CREATE TABLE admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT admins_role_check CHECK (role IN ('superadmin', 'admin', 'viewer'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABEL SESSIONS — sesi login admin (token acak, bukan base64)
-- ============================================
CREATE TABLE sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  user_agent TEXT NULL,
  ip_hash VARCHAR(64) NULL,
  last_seen_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  CONSTRAINT fk_sessions_admin FOREIGN KEY (admin_id)
    REFERENCES admins(id) ON DELETE CASCADE,
  INDEX idx_sessions_token (token),
  INDEX idx_sessions_admin (admin_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABEL CATEGORIES — kategori aplikasi
-- ============================================
CREATE TABLE categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABEL APPS — direktori aplikasi
-- status: active | inactive | maintenance | deprecated
-- env   : production | staging | development
--
-- Kolom katalog publik (lihat migrasi 07):
--   slug      → URL publik /katalog/<slug>, stabil walau nama berubah
--   is_public → SATU-SATUNYA penentu apakah aplikasi tampil di katalog
--               publik. DEFAULT FALSE = aman secara default.
--   logo_url, go_live_date, contact_* → isi "kartu profil" publik.
-- Kolom `server`, `database`, `env`, `progress` bersifat INTERNAL dan
-- tidak pernah dikirim ke permukaan publik (lihat src/lib/public.ts).
-- ============================================
CREATE TABLE apps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(220) NULL UNIQUE,
  category_id INT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'maintenance', 'deprecated')),
  env VARCHAR(20) NOT NULL DEFAULT 'production'
    CHECK (env IN ('production', 'staging', 'development')),
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  url TEXT,
  owner VARCHAR(100),
  version VARCHAR(50),
  progress SMALLINT NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  description TEXT,
  server VARCHAR(100),
  `database` VARCHAR(100),
  logo_url TEXT,
  go_live_date DATE,
  contact_name VARCHAR(100),
  contact_email VARCHAR(150),
  contact_phone VARCHAR(30),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_apps_category FOREIGN KEY (category_id)
    REFERENCES categories(id) ON DELETE SET NULL,
  INDEX idx_apps_category (category_id),
  INDEX idx_apps_status (status),
  INDEX idx_apps_is_public (is_public)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABEL APP_TECH — teknologi per aplikasi (banyak-ke-banyak)
-- ============================================
CREATE TABLE app_tech (
  app_id INT NOT NULL,
  tech VARCHAR(50) NOT NULL,
  PRIMARY KEY (app_id, tech),
  CONSTRAINT fk_apptech_app FOREIGN KEY (app_id)
    REFERENCES apps(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABEL APP_SCREENSHOTS — tangkapan layar per aplikasi
-- Tabel anak (bukan kolom array/JSON) supaya alurnya sama persis di
-- PostgreSQL. Pola sama seperti app_tech: saat aplikasi disunting,
-- seluruh baris diganti.
-- ============================================
CREATE TABLE app_screenshots (
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

-- ============================================
-- TABEL ACTIVITY_LOGS — riwayat perubahan (audit trail)
-- action  : create | update | delete | import | reset
-- entity  : app | category | technology | system
-- ============================================
CREATE TABLE activity_logs (
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

-- ============================================
-- TABEL LOGIN_LOGS — jejak percobaan login BERHASIL & GAGAL (migrasi 08)
-- Alamat IP hanya disimpan sebagai HASH (UU PDP 27/2022).
-- admin_id boleh NULL: percobaan dengan username tak dikenal tetap dicatat.
-- ============================================
CREATE TABLE login_logs (
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

-- ============================================
-- TABEL APP_CHANGELOGS — riwayat versi per aplikasi (migrasi 08)
-- kind    : feature | fix | security | other
-- is_public FALSE = catatan internal, tidak tampil di katalog publik.
-- ============================================
CREATE TABLE app_changelogs (
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

-- ============================================
-- TABEL SETTINGS — pengaturan key-value aplikasi
-- ============================================
CREATE TABLE settings (
  `key` VARCHAR(100) PRIMARY KEY,
  `value` TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- DATA AWAL
-- ============================================

-- Insert admin default (password: admin123, hash bcrypt — sama di kedua DB)
INSERT INTO admins (username, password_hash)
VALUES ('admin', '$2b$10$HImzDVHn/EIqfB17WkHb7u9woOtugON5KnWu2FBhTmDflpehZbZNu');

-- Kategori default (diambil dari data awal aplikasi)
INSERT INTO categories (name) VALUES
  ('HRIS'), ('Office'), ('Monitoring'), ('Education'),
  ('Support'), ('Inventory'), ('Community'), ('Procurement'),
  ('Analytics'), ('Management'), ('Content'), ('CRM'),
  ('E-Commerce'), ('Finance'), ('Infrastructure'), ('Tools');

-- ============================================
-- CONTOH DATA APLIKASI (opsional — hapus bila tidak diperlukan)
-- ============================================
INSERT INTO apps (name, slug, category_id, status, env, is_public, url, owner, version, progress, description, server, `database`, go_live_date, contact_name, contact_email)
SELECT 'Sistem Informasi Kepegawaian', 'sistem-informasi-kepegawaian', c.id, 'active', 'production', TRUE,
       'https://sik.example.com', 'Dinas Kominfo', '3.2.1', 95,
       'Sistem untuk manajemen data pegawai dan kehadiran.',
       'srv-hris-01', 'MySQL 8.0',
       '2023-01-16', 'Admin SIK', 'sik@example.com'
FROM categories c WHERE c.name = 'HRIS';

INSERT INTO apps (name, slug, category_id, status, env, is_public, url, owner, version, progress, description, server, `database`, go_live_date, contact_name, contact_email)
SELECT 'E-Office', 'e-office', c.id, 'active', 'production', TRUE,
       'https://eoffice.example.com', 'Bagian Umum', '2.0.0', 100,
       'Aplikasi surat menyurat dan disposisi digital.',
       'srv-eof-01', 'PostgreSQL 15',
       '2022-08-01', 'Admin E-Office', 'eoffice@example.com'
FROM categories c WHERE c.name = 'Office';

INSERT INTO app_tech (app_id, tech)
SELECT a.id, 'Laravel' FROM apps a WHERE a.name = 'Sistem Informasi Kepegawaian';
INSERT INTO app_tech (app_id, tech)
SELECT a.id, 'MySQL' FROM apps a WHERE a.name = 'Sistem Informasi Kepegawaian';
INSERT INTO app_tech (app_id, tech)
SELECT a.id, 'Bootstrap' FROM apps a WHERE a.name = 'Sistem Informasi Kepegawaian';

INSERT INTO app_tech (app_id, tech)
SELECT a.id, 'React' FROM apps a WHERE a.name = 'E-Office';
INSERT INTO app_tech (app_id, tech)
SELECT a.id, 'Node.js' FROM apps a WHERE a.name = 'E-Office';
INSERT INTO app_tech (app_id, tech)
SELECT a.id, 'PostgreSQL' FROM apps a WHERE a.name = 'E-Office';

-- ============================================
-- REALTIME — catatan paritas
-- Realtime (endpoint SSE /api/realtime) adalah fitur Supabase-only
-- (publikasi `supabase_realtime`). Tidak ada padanan SQL di MySQL;
-- pada mode MySQL/Laragon sinkronisasi cukup mengandalkan polling klien.
-- ============================================

-- ============================================
-- VERIFIKASI
-- ============================================
SELECT id, username, created_at FROM admins WHERE username = 'admin';
SELECT id, name FROM categories ORDER BY id;
SELECT a.id, a.name, a.slug, c.name AS category, a.status, a.env, a.is_public, a.progress
FROM apps a LEFT JOIN categories c ON c.id = a.category_id
ORDER BY a.id;
