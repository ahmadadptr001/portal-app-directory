-- ============================================================
-- MIGRASI 04 — Backdate created_at seed (supabase / PostgreSQL)
-- Database : PostgreSQL / Supabase
--
-- Masalah: migrasi 01 menyimpan SEMUA aplikasi dummy dengan
-- created_at = NOW() (waktu seed dijalankan). Akibatnya metrik
-- "pertumbuhan mingguan" di dashboard tidak pernah punya data
-- pembanding minggu lalu (lastWeek = 0).
--
-- Solusi: sebar created_at 17 aplikasi dummy ke rentang 1-50
-- hari terakhir, mengikuti nilai yang sama seperti migrasi 01
-- yang sudah diperbarui. Idempotent — aman dijalankan berulang.
--
-- KONVENSI: file ini dipasangkan dengan
--   migrations/mysql/04_backdate_created_at.sql
-- ============================================================

BEGIN;

UPDATE apps SET created_at = NOW() - INTERVAL '1 day'   WHERE id = 1;
UPDATE apps SET created_at = NOW() - INTERVAL '2 days'  WHERE id = 2;
UPDATE apps SET created_at = NOW() - INTERVAL '3 days'  WHERE id = 3;
UPDATE apps SET created_at = NOW() - INTERVAL '4 days'  WHERE id = 4;
UPDATE apps SET created_at = NOW() - INTERVAL '5 days'  WHERE id = 5;
UPDATE apps SET created_at = NOW() - INTERVAL '9 days'  WHERE id = 6;
UPDATE apps SET created_at = NOW() - INTERVAL '10 days' WHERE id = 7;
UPDATE apps SET created_at = NOW() - INTERVAL '11 days' WHERE id = 8;
UPDATE apps SET created_at = NOW() - INTERVAL '12 days' WHERE id = 9;
UPDATE apps SET created_at = NOW() - INTERVAL '20 days' WHERE id = 10;
UPDATE apps SET created_at = NOW() - INTERVAL '21 days' WHERE id = 11;
UPDATE apps SET created_at = NOW() - INTERVAL '25 days' WHERE id = 12;
UPDATE apps SET created_at = NOW() - INTERVAL '30 days' WHERE id = 13;
UPDATE apps SET created_at = NOW() - INTERVAL '35 days' WHERE id = 14;
UPDATE apps SET created_at = NOW() - INTERVAL '40 days' WHERE id = 15;
UPDATE apps SET created_at = NOW() - INTERVAL '45 days' WHERE id = 16;
UPDATE apps SET created_at = NOW() - INTERVAL '50 days' WHERE id = 17;

COMMIT;

-- VERIFIKASI
SELECT id, name, created_at FROM apps ORDER BY id;
