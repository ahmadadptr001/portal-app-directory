-- ============================================================
-- MIGRASI 08 — Tier 3: peran admin, jejak login, changelog aplikasi
-- Database : PostgreSQL / Supabase
--
-- Latar belakang:
--   Portal sudah punya katalog publik (migrasi 07). Tahap ini melengkapi
--   sisi kelembagaannya: siapa boleh melakukan apa (peran), siapa masuk
--   kapan dari mana (jejak login + sesi aktif), dan riwayat versi tiap
--   aplikasi (changelog) agar perubahan layanan bisa ditelusuri publik.
--
-- Isi:
--   1. Kolom `admins.role` (superadmin | admin | viewer) + backfill
--   2. Metadata sesi: user_agent, ip_hash, last_seen_at
--   3. Tabel `login_logs` — jejak login berhasil DAN gagal
--   4. Tabel `app_changelogs` — riwayat versi per aplikasi
--   5. Daftarkan tabel baru ke publikasi realtime
--
-- CATATAN PRIVASI (penting):
--   Alamat IP TIDAK disimpan mentah, hanya hash-nya (`ip_hash`). Alamat IP
--   adalah data pribadi menurut UU PDP No. 27/2022; menyimpan hash sudah
--   cukup untuk mengenali pola "masuk dari tempat berbeda" tanpa menyimpan
--   identitas yang bisa langsung dipakai. Garam hash ada di sisi aplikasi
--   (env IP_HASH_SALT), jadi hash tidak bisa dibalik lewat tabel pelangi.
--
-- CATATAN PERAN:
--   Backfill menjadikan admin dengan id TERKECIL sebagai `superadmin`
--   (biasanya akun 'admin' bawaan), sisanya `admin`. Backfill dikurung di
--   cabang "kolom baru dibuat" supaya menjalankan migrasi dua kali TIDAK
--   menimpa peran yang sudah diatur manual.
--
-- Aman dijalankan berulang (idempotent).
--
-- KONVENSI: dipasangkan dengan
--   migrations/mysql/08_add_roles_login_trail_changelog.sql
-- Jalankan via Supabase SQL Editor SETELAH migrasi 07.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. PERAN ADMIN
--    superadmin : kelola akun & peran, cabut sesi, reset data
--    admin      : kelola aplikasi/kategori/teknologi
--    viewer     : hanya melihat (tidak boleh mengubah apa pun)
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'admins' AND column_name = 'role'
  ) THEN
    ALTER TABLE admins ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'admin';

    -- Akun pertama menjadi superadmin supaya selalu ada yang bisa
    -- mengelola akun lain setelah migrasi.
    UPDATE admins SET role = 'superadmin'
    WHERE id = (SELECT MIN(id) FROM admins);
  END IF;
END $$;

-- CHECK dipasang terpisah & idempotent (nama constraint dicek dulu).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admins_role_check'
  ) THEN
    ALTER TABLE admins ADD CONSTRAINT admins_role_check
      CHECK (role IN ('superadmin', 'admin', 'viewer'));
  END IF;
END $$;

-- ------------------------------------------------------------
-- 2. METADATA SESI
--    Dipakai halaman "Sesi Aktif": perangkat apa, dari mana, kapan
--    terakhir terlihat — supaya sesi mencurigakan bisa dicabut.
-- ------------------------------------------------------------
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip_hash VARCHAR(64);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- ------------------------------------------------------------
-- 3. JEJAK LOGIN
--    Mencatat percobaan BERHASIL dan GAGAL. Yang gagal justru yang
--    paling berguna: lonjakan kegagalan pada satu username adalah tanda
--    percobaan masuk paksa.
--
--    `admin_id` boleh NULL — percobaan dengan username yang tidak ada
--    tetap dicatat, dan barisnya harus bertahan walau akunnya dihapus.
--    Karena itu `username_attempt` disimpan sebagai teks terpisah.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS login_logs (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
  username_attempt VARCHAR(50) NOT NULL,
  success BOOLEAN NOT NULL,
  reason VARCHAR(50),
  ip_hash VARCHAR(64),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_logs_created ON login_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_logs_username ON login_logs(username_attempt);
CREATE INDEX IF NOT EXISTS idx_login_logs_success ON login_logs(success);

ALTER TABLE login_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'login_logs' AND policyname = 'Service role only'
  ) THEN
    EXECUTE 'CREATE POLICY "Service role only" ON login_logs FOR ALL USING (auth.role() = ''service_role'')';
  END IF;
END $$;

-- ------------------------------------------------------------
-- 4. CHANGELOG APLIKASI
--    Riwayat versi per aplikasi. `is_public` mengikuti pola migrasi 07:
--    catatan internal bisa disimpan tanpa ikut tampil di katalog.
--    kind: feature | fix | security | other
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_changelogs (
  id SERIAL PRIMARY KEY,
  app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  version VARCHAR(50) NOT NULL,
  released_at DATE,
  kind VARCHAR(20) NOT NULL DEFAULT 'other',
  notes TEXT,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_changelogs_app
  ON app_changelogs(app_id, released_at DESC);

ALTER TABLE app_changelogs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'app_changelogs' AND policyname = 'Service role only'
  ) THEN
    EXECUTE 'CREATE POLICY "Service role only" ON app_changelogs FOR ALL USING (auth.role() = ''service_role'')';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'app_changelogs_kind_check'
  ) THEN
    ALTER TABLE app_changelogs ADD CONSTRAINT app_changelogs_kind_check
      CHECK (kind IN ('feature', 'fix', 'security', 'other'));
  END IF;
END $$;

-- ------------------------------------------------------------
-- 5. REALTIME — daftarkan tabel baru (idempotent)
-- ------------------------------------------------------------
DO $$
DECLARE tbl text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH tbl IN ARRAY ARRAY['login_logs', 'app_changelogs'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = tbl
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', tbl);
      END IF;
    END LOOP;
  END IF;
END $$;

COMMIT;

-- ============================================================
-- VERIFIKASI
-- ============================================================
SELECT id, username, role FROM admins ORDER BY id;

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'sessions'
  AND column_name IN ('user_agent', 'ip_hash', 'last_seen_at')
ORDER BY column_name;

SELECT COUNT(*) AS total_login_logs FROM login_logs;
SELECT COUNT(*) AS total_changelogs FROM app_changelogs;
