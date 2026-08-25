-- ============================================================
-- Schema Portal Direktori Aplikasi — PostgreSQL / Supabase
-- Jalankan SQL ini di Supabase SQL Editor
--
-- KEPUTUSAN ARSITEKTUR: autentikasi memakai tabel kustom `admins`
-- (bukan auth.users Supabase) agar portabel ke MySQL/Laragon.
--
-- KONVENSI: file ini dipasangkan dengan schema.mysql.sql.
-- Setiap perubahan di schema.mysql.sql WAJIB diterapkan juga di sini
-- dengan alur yang sama persis, hanya syntax disesuaikan per DB.
-- ============================================================

-- ============================================
-- HAPUS TABEL (jika ada) — urutan sesuai foreign key
-- ============================================
DROP TABLE IF EXISTS activity_logs;
DROP TABLE IF EXISTS login_logs;
DROP TABLE IF EXISTS app_changelogs;
DROP TABLE IF EXISTS media_files;
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
--   UPDATE admins SET role = 'superadmin' WHERE id = (SELECT MIN(id) FROM admins);
-- )
-- ============================================
CREATE TABLE admins (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT admins_role_check CHECK (role IN ('superadmin', 'admin', 'viewer'))
);

ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON admins
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- TABEL SESSIONS — sesi login admin (token acak, bukan base64)
-- ============================================
CREATE TABLE sessions (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  user_agent TEXT,
  ip_hash VARCHAR(64),
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_admin ON sessions(admin_id);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON sessions
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- TABEL CATEGORIES — kategori aplikasi
-- ============================================
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON categories
  FOR ALL USING (auth.role() = 'service_role');

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
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(220) UNIQUE,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
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
  database VARCHAR(100),
  logo_url TEXT,
  go_live_date DATE,
  contact_name VARCHAR(100),
  contact_email VARCHAR(150),
  contact_phone VARCHAR(30),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_apps_category ON apps(category_id);
CREATE INDEX idx_apps_status ON apps(status);
CREATE INDEX idx_apps_is_public ON apps(is_public);

ALTER TABLE apps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON apps
  FOR ALL USING (auth.role() = 'service_role');

-- Trigger updated_at (paritas dengan MySQL: ON UPDATE CURRENT_TIMESTAMP)
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_apps_updated_at BEFORE UPDATE ON apps
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================
-- TABEL APP_TECH — teknologi per aplikasi (banyak-ke-banyak)
-- ============================================
CREATE TABLE app_tech (
  app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  tech VARCHAR(50) NOT NULL,
  PRIMARY KEY (app_id, tech)
);

ALTER TABLE app_tech ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON app_tech
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- TABEL APP_SCREENSHOTS — tangkapan layar per aplikasi
-- Tabel anak (bukan kolom array/JSON) supaya alurnya sama persis di
-- MySQL yang tidak punya tipe array. Pola sama seperti app_tech:
-- saat aplikasi disunting, seluruh baris diganti.
-- ============================================
CREATE TABLE app_screenshots (
  id SERIAL PRIMARY KEY,
  app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  caption VARCHAR(200),
  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_app_screenshots_app ON app_screenshots(app_id, sort_order);

ALTER TABLE app_screenshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON app_screenshots
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- TABEL ACTIVITY_LOGS — riwayat perubahan (audit trail)
-- action  : create | update | delete | import | reset
-- entity  : app | category | technology | system
-- ============================================
CREATE TABLE activity_logs (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
  admin_username VARCHAR(50) NOT NULL,
  action VARCHAR(20) NOT NULL,
  entity_type VARCHAR(20) NOT NULL,
  entity_name VARCHAR(200) NOT NULL,
  entity_id INTEGER,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_created ON activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_entity ON activity_logs(entity_type);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON activity_logs
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- TABEL LOGIN_LOGS — jejak percobaan login BERHASIL & GAGAL (migrasi 08)
-- Alamat IP hanya disimpan sebagai HASH (UU PDP 27/2022).
-- admin_id boleh NULL: percobaan dengan username tak dikenal tetap dicatat.
-- ============================================
CREATE TABLE login_logs (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
  username_attempt VARCHAR(50) NOT NULL,
  success BOOLEAN NOT NULL,
  reason VARCHAR(50),
  ip_hash VARCHAR(64),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_login_logs_created ON login_logs(created_at DESC);
CREATE INDEX idx_login_logs_username ON login_logs(username_attempt);
CREATE INDEX idx_login_logs_success ON login_logs(success);

ALTER TABLE login_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON login_logs
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- TABEL APP_CHANGELOGS — riwayat versi per aplikasi (migrasi 08)
-- kind    : feature | fix | security | other
-- is_public FALSE = catatan internal, tidak tampil di katalog publik.
-- ============================================
CREATE TABLE app_changelogs (
  id SERIAL PRIMARY KEY,
  app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  version VARCHAR(50) NOT NULL,
  released_at DATE,
  kind VARCHAR(20) NOT NULL DEFAULT 'other',
  notes TEXT,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT app_changelogs_kind_check
    CHECK (kind IN ('feature', 'fix', 'security', 'other'))
);

CREATE INDEX idx_app_changelogs_app ON app_changelogs(app_id, released_at DESC);

ALTER TABLE app_changelogs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON app_changelogs
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- TABEL MEDIA_FILES — buku besar aset gambar (migrasi 09)
-- Satu baris per URL gambar. driver:
--   supabase → bucket app-media (dapat dibersihkan via storage API)
--   local    → public/uploads (deploy MySQL/Laragon)
--   external → URL tempelan manual dari luar (tidak pernah di-GC)
-- ============================================
CREATE TABLE media_files (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  path TEXT,
  driver VARCHAR(20) NOT NULL DEFAULT 'external',
  mime VARCHAR(50),
  size_bytes INTEGER,
  uploaded_by INTEGER REFERENCES admins(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_media_files_created ON media_files(created_at DESC);
CREATE INDEX idx_media_files_driver ON media_files(driver);

ALTER TABLE media_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON media_files
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- TABEL SETTINGS — pengaturan key-value aplikasi
-- ============================================
CREATE TABLE settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON settings
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER trg_settings_updated_at BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================
-- DATA AWAL
-- ============================================

-- Insert admin default (password: admin123, hash bcrypt)
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
INSERT INTO apps (name, slug, category_id, status, env, is_public, url, owner, version, progress, description, server, database, go_live_date, contact_name, contact_email)
SELECT 'Sistem Informasi Kepegawaian', 'sistem-informasi-kepegawaian', c.id, 'active', 'production', TRUE,
       'https://sik.example.com', 'Dinas Kominfo', '3.2.1', 95,
       'Sistem untuk manajemen data pegawai dan kehadiran.',
       'srv-hris-01', 'MySQL 8.0',
       '2023-01-16', 'Admin SIK', 'sik@example.com'
FROM categories c WHERE c.name = 'HRIS';

INSERT INTO apps (name, slug, category_id, status, env, is_public, url, owner, version, progress, description, server, database, go_live_date, contact_name, contact_email)
SELECT 'E-Office', 'e-office', c.id, 'active', 'production', TRUE,
       'https://eoffice.example.com', 'Bagian Umum', '2.0.0', 100,
       'Aplikasi surat menyurat dan disposisi digital.',
       'srv-eof-01', 'PostgreSQL 15',
       '2022-08-01', 'Admin E-Office', 'eoffice@example.com'
FROM categories c WHERE c.name = 'Office';

INSERT INTO app_tech (app_id, tech)
SELECT a.id, t.tech
FROM apps a,
     (VALUES ('Laravel'), ('MySQL'), ('Bootstrap')) AS t(tech)
WHERE a.name = 'Sistem Informasi Kepegawaian';

INSERT INTO app_tech (app_id, tech)
SELECT a.id, t.tech
FROM apps a,
     (VALUES ('React'), ('Node.js'), ('PostgreSQL')) AS t(tech)
WHERE a.name = 'E-Office';

-- ============================================
-- REALTIME — publikasi perubahan tabel
-- (dipakai endpoint SSE /api/realtime; fitur Supabase-only,
--  tidak ada padanan di MySQL/Laragon)
-- ============================================
-- Idempotent: hanya menambah tabel yang belum terdaftar.
DO $$
DECLARE tbl text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH tbl IN ARRAY ARRAY['categories', 'apps', 'app_tech', 'app_screenshots'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = tbl
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', tbl);
      END IF;
    END LOOP;
  END IF;
END $$;

-- ============================================
-- VERIFIKASI
-- ============================================
SELECT id, username, created_at FROM admins WHERE username = 'admin';
SELECT id, name FROM categories ORDER BY id;
SELECT a.id, a.name, a.slug, c.name AS category, a.status, a.env, a.is_public, a.progress
FROM apps a LEFT JOIN categories c ON c.id = a.category_id
ORDER BY a.id;
