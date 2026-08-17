-- ============================================================
-- MIGRASI 02 — Aktifkan Realtime untuk tabel inti
-- Database : PostgreSQL / Supabase
--
-- Isi:
--   Daftarkan tabel `apps`, `app_tech`, dan `categories` ke
--   publikasi `supabase_realtime` agar endpoint SSE
--   (/api/realtime) menerima event postgres_changes.
--
-- Aman dijalankan berulang (idempotent): tabel yang sudah
-- terdaftar tidak akan ditambahkan lagi. Tidak menghapus data.
--
-- KONVENSI: file ini dipasangkan dengan
--   migrations/mysql/02_enable_realtime.sql
-- Jalankan via Supabase SQL Editor SETELAH schema.supabase.sql.
-- ============================================================

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
  ELSE
    RAISE NOTICE 'Publikasi supabase_realtime tidak ditemukan — aktifkan Realtime di dashboard Supabase terlebih dahulu.';
  END IF;
END $$;

-- Verifikasi
SELECT pubname, schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
ORDER BY tablename;
