-- ============================================================
-- MIGRASI 03 — Sinkronkan AUTO_INCREMENT (paritas dengan Supabase)
-- Database : MySQL / Laragon (MySQL 8.0+)
--
-- Latar belakang:
--   Migrasi 01 memasukkan seed dengan id EKSPLISIT (1-17). MySQL
--   TIDAK menggerakkan AUTO_INCREMENT untuk id eksplisit, sehingga
--   INSERT berikutnya menabrak id yang sudah ada (error 1062).
--
-- Isi:
--   Setel AUTO_INCREMENT ke MAX(id)+1. Idempotent.
--
-- KONVENSI: dipasangkan dengan
--   migrations/supabase/03_fix_sequence_ids.sql
-- Jalankan di phpMyAdmin / MySQL CLI.
-- ============================================================

SET @next_id := (SELECT COALESCE(MAX(id), 0) + 1 FROM apps);
SET @sql := CONCAT('ALTER TABLE apps AUTO_INCREMENT = ', @next_id);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @next_id := (SELECT COALESCE(MAX(id), 0) + 1 FROM categories);
SET @sql := CONCAT('ALTER TABLE categories AUTO_INCREMENT = ', @next_id);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @next_id := (SELECT COALESCE(MAX(id), 0) + 1 FROM admins);
SET @sql := CONCAT('ALTER TABLE admins AUTO_INCREMENT = ', @next_id);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Verifikasi
SELECT AUTO_INCREMENT FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('apps', 'categories', 'admins') ORDER BY TABLE_NAME;
