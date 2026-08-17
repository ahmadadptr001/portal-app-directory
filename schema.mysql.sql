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
DROP TABLE IF EXISTS app_tech;
DROP TABLE IF EXISTS apps;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS admins;

-- ============================================
-- TABEL ADMINS (auth kustom) — struktur sama dengan schema.sql
-- ============================================
CREATE TABLE admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABEL SESSIONS — sesi login admin (token acak, bukan base64)
-- ============================================
CREATE TABLE sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
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
-- ============================================
CREATE TABLE apps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  category_id INT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'maintenance', 'deprecated')),
  env VARCHAR(20) NOT NULL DEFAULT 'production'
    CHECK (env IN ('production', 'staging', 'development')),
  url TEXT,
  owner VARCHAR(100),
  version VARCHAR(50),
  progress SMALLINT NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  description TEXT,
  server VARCHAR(100),
  `database` VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_apps_category FOREIGN KEY (category_id)
    REFERENCES categories(id) ON DELETE SET NULL,
  INDEX idx_apps_category (category_id),
  INDEX idx_apps_status (status)
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
INSERT INTO apps (name, category_id, status, env, url, owner, version, progress, description, server, `database`)
SELECT 'Sistem Informasi Kepegawaian', c.id, 'active', 'production',
       'https://sik.example.com', 'Dinas Kominfo', '3.2.1', 95,
       'Sistem untuk manajemen data pegawai dan kehadiran.',
       'srv-hris-01', 'MySQL 8.0'
FROM categories c WHERE c.name = 'HRIS';

INSERT INTO apps (name, category_id, status, env, url, owner, version, progress, description, server, `database`)
SELECT 'E-Office', c.id, 'active', 'production',
       'https://eoffice.example.com', 'Bagian Umum', '2.0.0', 100,
       'Aplikasi surat menyurat dan disposisi digital.',
       'srv-eof-01', 'PostgreSQL 15'
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
SELECT a.id, a.name, c.name AS category, a.status, a.env, a.progress
FROM apps a LEFT JOIN categories c ON c.id = a.category_id
ORDER BY a.id;
