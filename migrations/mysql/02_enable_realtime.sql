-- ============================================================
-- MIGRASI 02 — Realtime (paritas konvensi)
-- Database : MySQL / Laragon (MySQL 8.0+)
--
-- Isi:
--   (tidak ada) — Realtime / SSE (/api/realtime) adalah fitur
--   Supabase-only (publikasi `supabase_realtime`). MySQL tidak
--   punya padanan; pada mode MySQL/Laragon sinkronisasi data
--   cukup mengandalkan polling klien di halaman.
--
-- File ini ada demi paritas konvensi:
--   migrations/supabase/02_enable_realtime.sql
-- ============================================================

SELECT 'Realtime tidak berlaku untuk MySQL/Laragon' AS info;
