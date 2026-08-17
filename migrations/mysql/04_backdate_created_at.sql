-- ============================================================
-- MIGRASI 04 — Backdate created_at seed (MySQL / Laragon)
-- Database : MySQL / Laragon (MySQL 8.0+)
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
--   migrations/supabase/04_backdate_created_at.sql
-- ============================================================

START TRANSACTION;

UPDATE apps SET created_at = NOW() - INTERVAL 1 DAY  WHERE id = 1;
UPDATE apps SET created_at = NOW() - INTERVAL 2 DAY  WHERE id = 2;
UPDATE apps SET created_at = NOW() - INTERVAL 3 DAY  WHERE id = 3;
UPDATE apps SET created_at = NOW() - INTERVAL 4 DAY  WHERE id = 4;
UPDATE apps SET created_at = NOW() - INTERVAL 5 DAY  WHERE id = 5;
UPDATE apps SET created_at = NOW() - INTERVAL 9 DAY  WHERE id = 6;
UPDATE apps SET created_at = NOW() - INTERVAL 10 DAY WHERE id = 7;
UPDATE apps SET created_at = NOW() - INTERVAL 11 DAY WHERE id = 8;
UPDATE apps SET created_at = NOW() - INTERVAL 12 DAY WHERE id = 9;
UPDATE apps SET created_at = NOW() - INTERVAL 20 DAY WHERE id = 10;
UPDATE apps SET created_at = NOW() - INTERVAL 21 DAY WHERE id = 11;
UPDATE apps SET created_at = NOW() - INTERVAL 25 DAY WHERE id = 12;
UPDATE apps SET created_at = NOW() - INTERVAL 30 DAY WHERE id = 13;
UPDATE apps SET created_at = NOW() - INTERVAL 35 DAY WHERE id = 14;
UPDATE apps SET created_at = NOW() - INTERVAL 40 DAY WHERE id = 15;
UPDATE apps SET created_at = NOW() - INTERVAL 45 DAY WHERE id = 16;
UPDATE apps SET created_at = NOW() - INTERVAL 50 DAY WHERE id = 17;

COMMIT;

-- VERIFIKASI
SELECT id, name, created_at FROM apps ORDER BY id;
