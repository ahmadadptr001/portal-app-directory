-- ============================================================
-- MIGRASI 03 — Sinkronkan sequence id (perbaikan error 500 saat tambah)
-- Database : PostgreSQL / Supabase
--
-- Latar belakang:
--   Migrasi 01 memasukkan seed dengan id EKSPLISIT (1-17) lewat
--   `INSERT INTO apps (id, ...)`. INSERT dengan id eksplisit TIDAK
--   menggerakkan sequence PostgreSQL (`apps_id_seq`), sehingga
--   INSERT baru tanpa id menabrak id yang sudah ada:
--     duplicate key value violates unique constraint "apps_pkey"
--   dan API POST /api/apps mengembalikan 500.
--
-- Isi:
--   Setel sequence ke MAX(id) tabel agar INSERT berikutnya memakai
--   id lanjutan yang aman. Idempotent — aman dijalankan berulang.
--
-- KONVENSI: dipasangkan dengan
--   migrations/mysql/03_fix_sequence_ids.sql
-- Jalankan via Supabase SQL Editor SETELAH migrasi 02.
-- ============================================================

SELECT setval(pg_get_serial_sequence('apps', 'id'), (SELECT COALESCE(MAX(id), 0) FROM apps), true);
SELECT setval(pg_get_serial_sequence('categories', 'id'), (SELECT COALESCE(MAX(id), 0) FROM categories), true);
SELECT setval(pg_get_serial_sequence('admins', 'id'), (SELECT COALESCE(MAX(id), 0) FROM admins), true);

-- Verifikasi: nilai berikutnya yang akan dipakai sequence
SELECT 'apps' AS tabel, currval(pg_get_serial_sequence('apps', 'id')) AS current_last_id
UNION ALL SELECT 'categories', currval(pg_get_serial_sequence('categories', 'id'))
UNION ALL SELECT 'admins', currval(pg_get_serial_sequence('admins', 'id'));
