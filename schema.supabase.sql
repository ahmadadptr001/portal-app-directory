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
DROP TABLE IF EXISTS app_tech;
DROP TABLE IF EXISTS apps;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS admins;

-- ============================================
-- TABEL ADMINS (auth kustom) — struktur LAMA, TIDAK DIUBAH
-- ============================================
CREATE TABLE admins (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
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
-- ============================================
CREATE TABLE apps (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
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
  database VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_apps_category ON apps(category_id);
CREATE INDEX idx_apps_status ON apps(status);

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
INSERT INTO apps (name, category_id, status, env, url, owner, version, progress, description, server, database)
SELECT 'Sistem Informasi Kepegawaian', c.id, 'active', 'production',
       'https://sik.example.com', 'Dinas Kominfo', '3.2.1', 95,
       'Sistem untuk manajemen data pegawai dan kehadiran.',
       'srv-hris-01', 'MySQL 8.0'
FROM categories c WHERE c.name = 'HRIS';

INSERT INTO apps (name, category_id, status, env, url, owner, version, progress, description, server, database)
SELECT 'E-Office', c.id, 'active', 'production',
       'https://eoffice.example.com', 'Bagian Umum', '2.0.0', 100,
       'Aplikasi surat menyurat dan disposisi digital.',
       'srv-eof-01', 'PostgreSQL 15'
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
    FOREACH tbl IN ARRAY ARRAY['categories', 'apps', 'app_tech'] LOOP
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
SELECT a.id, a.name, c.name AS category, a.status, a.env, a.progress
FROM apps a LEFT JOIN categories c ON c.id = a.category_id
ORDER BY a.id;
