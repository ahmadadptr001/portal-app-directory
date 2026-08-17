-- ============================================================
-- MIGRASI 06 — Tabel `activity_logs` (riwayat perubahan / audit trail)
-- Database : PostgreSQL / Supabase
--
-- Latar belakang:
--   Portal belum punya jejak audit: tidak ada catatan siapa yang
--   menambah/mengubah/menghapus data. Migrasi ini menambah tabel
--   `activity_logs` untuk keperluan profesionalitas & akuntabilitas.
--
-- Isi:
--   1. Buat tabel `activity_logs` (idempotent: IF NOT EXISTS)
--   2. Daftarkan tabel ke publikasi realtime `supabase_realtime`
--      (agar halaman Log Aktivitas ter-update otomatis)
--
-- Aman dijalankan berulang (idempotent): tabel yang sudah ada
-- tidak dibuat ulang, policy tidak diduplikasi, dan tabel yang
-- sudah terdaftar di realtime tidak didaftarkan dua kali.
--
-- KONVENSI: dipasangkan dengan
--   migrations/mysql/06_add_activity_logs.sql
-- Jalankan via Supabase SQL Editor SETELAH schema.supabase.sql
-- dan migrasi 01–04.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. TABEL ACTIVITY_LOGS
--    action  : create | update | delete | import | reset
--    entity  : app | category | technology | system
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activity_logs (
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

CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Policy idempotent: hanya dibuat bila belum ada.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'activity_logs' AND policyname = 'Service role only'
  ) THEN
    EXECUTE 'CREATE POLICY "Service role only" ON activity_logs FOR ALL USING (auth.role() = ''service_role'')';
  END IF;
END $$;

-- ------------------------------------------------------------
-- 2. REALTIME — daftarkan tabel ke publikasi supabase_realtime
--    (idempotent: hanya menambah bila belum terdaftar)
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'activity_logs'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE activity_logs;
    END IF;
  END IF;
END $$;

COMMIT;

-- ============================================================
-- VERIFIKASI
-- ============================================================
SELECT COUNT(*) AS total_logs FROM activity_logs;
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'activity_logs'
ORDER BY ordinal_position;
