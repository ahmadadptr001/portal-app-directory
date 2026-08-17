-- ============================================================
-- MIGRASI 01 — Seed dummy data lengkap (aplikasi, kategori, tech)
-- Database : MySQL / Laragon (MySQL 8.0+)
--
-- Isi:
--   1. Pastikan 16 kategori ada (idempotent)
--   2. Masukkan SEMUA 17 aplikasi dummy (id mengikuti APP_DATA
--      di src/data/initialData.ts) + relasi app_tech
--
-- Aman dijalankan berulang (idempotent): baris yang sudah ada
-- akan dilewati (ON DUPLICATE KEY UPDATE no-op).
-- Tidak menghapus data.
--
-- KONVENSI: file ini dipasangkan dengan
--   migrations/supabase/01_seed_dummy_data.sql
-- Jalankan di phpMyAdmin / MySQL CLI SETELAH schema.mysql.sql.
-- ============================================================

START TRANSACTION;

-- ------------------------------------------------------------
-- 1. KATEGORI — pastikan semuanya ada (16 kategori default)
-- ------------------------------------------------------------
INSERT INTO categories (name) VALUES
  ('HRIS'), ('Office'), ('Monitoring'), ('Education'),
  ('Support'), ('Inventory'), ('Community'), ('Procurement'),
  ('Analytics'), ('Management'), ('Content'), ('CRM'),
  ('E-Commerce'), ('Finance'), ('Infrastructure'), ('Tools')
ON DUPLICATE KEY UPDATE name = name;

-- ------------------------------------------------------------
-- 2. APLIKASI — 17 dummy app.
--    Kolom server/database yang kosong diisi NULL.
--    Alias kolom "db" karena `database` adalah reserved word.
-- ------------------------------------------------------------
INSERT INTO apps (id, name, category_id, status, env, url, owner, version, progress, description, server, `database`, created_at)
SELECT v.id, v.name, c.id, v.status, v.env, v.url, v.owner, v.version, v.progress, v.description, v.server, v.db, v.created_at
FROM (
  SELECT 1 AS id, 'Sistem Informasi Kepegawaian' AS name, 'HRIS' AS category, 'active' AS status, 'production' AS env,
         'https://sik.example.com' AS url, 'Dinas Kominfo' AS owner, '3.2.1' AS version, 95 AS progress,
         'Sistem untuk manajemen data pegawai dan kehadiran.' AS description, 'srv-hris-01' AS server, 'MySQL 8.0' AS db,
         NOW() - INTERVAL 1 DAY AS created_at
  UNION ALL
  SELECT 2, 'E-Office', 'Office', 'active', 'production',
         'https://eoffice.example.com', 'Bagian Umum', '2.0.0', 100,
         'Aplikasi surat menyurat dan disposisi digital.', 'srv-eof-01', 'PostgreSQL 15',
         NOW() - INTERVAL 2 DAY
  UNION ALL
  SELECT 3, 'Dashboard Monitoring', 'Monitoring', 'active', 'production',
         'https://monitor.example.com', 'IT Support', '1.5.0', 80,
         'Monitoring real-time server dan aplikasi.', 'srv-mon-01', 'MongoDB 6',
         NOW() - INTERVAL 3 DAY
  UNION ALL
  SELECT 4, 'E-Learning', 'Education', 'maintenance', 'staging',
         'https://elearning.example.com', 'Dinas Pendidikan', '4.1.2', 70,
         'Platform pembelajaran online untuk siswa dan guru.', 'srv-learn-01', 'Firebase',
         NOW() - INTERVAL 4 DAY
  UNION ALL
  SELECT 5, 'Helpdesk System', 'Support', 'active', 'production',
         'https://helpdesk.example.com', 'IT Service', '2.3.0', 90,
         'Sistem tiket untuk layanan helpdesk internal.', 'srv-hd-01', 'MariaDB 10',
         NOW() - INTERVAL 5 DAY
  UNION ALL
  SELECT 6, 'Inventory Management', 'Inventory', 'inactive', 'development',
         'https://inventory.example.com', 'Logistik', '1.0.0', 30,
         'Manajemen inventaris barang dan aset.', 'srv-inv-dev', 'PostgreSQL 14',
         NOW() - INTERVAL 9 DAY
  UNION ALL
  SELECT 7, 'Portal Alumni', 'Community', 'active', 'production',
         'https://alumni.example.com', 'Hubungan Alumni', '3.0.1', 85,
         'Portal untuk komunikasi dan jaringan alumni.', 'srv-alumni-01', 'MySQL 8.0',
         NOW() - INTERVAL 10 DAY
  UNION ALL
  SELECT 8, 'Sistem Pengadaan', 'Procurement', 'deprecated', 'staging',
         'https://pengadaan.example.com', 'Bagian Pengadaan', '1.2.0', 100,
         'Aplikasi untuk proses pengadaan barang dan jasa.', 'srv-proc-01', 'PostgreSQL 13',
         NOW() - INTERVAL 11 DAY
  UNION ALL
  SELECT 9, 'E-Presensi', 'HRIS', 'active', 'production',
         'https://presensi.example.com', 'HRD', '2.1.0', 75,
         'Sistem presensi berbasis web dan mobile.', 'srv-pres-01', NULL,
         NOW() - INTERVAL 12 DAY
  UNION ALL
  SELECT 10, 'Data Warehouse', 'Analytics', 'active', 'production',
         'https://dw.example.com', 'Data Team', '1.0.0', 60,
         'Penyimpanan dan analisis data terpusat.', NULL, 'Redshift',
         NOW() - INTERVAL 20 DAY
  UNION ALL
  SELECT 11, 'Project Management', 'Management', 'active', 'production',
         'https://pm.example.com', 'PMO', '4.0.0', 95,
         'Manajemen proyek dan tugas tim.', 'srv-pm-01', 'PostgreSQL 15',
         NOW() - INTERVAL 21 DAY
  UNION ALL
  SELECT 12, 'Knowledge Base', 'Content', 'maintenance', 'staging',
         'https://kb.example.com', 'Knowledge Management', '2.2.0', 65,
         'Basis pengetahuan perusahaan.', 'srv-kb-01', 'Elasticsearch 8',
         NOW() - INTERVAL 25 DAY
  UNION ALL
  SELECT 13, 'CRM System', 'CRM', 'inactive', 'development',
         'https://crm.example.com', 'Sales & Marketing', '0.9.0', 45,
         'Customer relationship management.', 'srv-crm-dev', 'PostgreSQL 14',
         NOW() - INTERVAL 30 DAY
  UNION ALL
  SELECT 14, 'E-Commerce Platform', 'E-Commerce', 'active', 'production',
         'https://shop.example.com', 'Digital Business', '5.1.0', 88,
         'Platform penjualan online.', 'srv-shop-01', 'PostgreSQL 15',
         NOW() - INTERVAL 35 DAY
  UNION ALL
  SELECT 15, 'Sistem Keuangan', 'Finance', 'active', 'production',
         'https://finance.example.com', 'Keuangan', '3.0.0', 92,
         'Manajemen keuangan dan akuntansi.', 'srv-fin-01', 'MySQL 8.0',
         NOW() - INTERVAL 40 DAY
  UNION ALL
  SELECT 16, 'API Gateway', 'Infrastructure', 'active', 'production',
         'https://api.example.com', 'DevOps', '2.4.0', 78,
         'Gateway untuk microservices.', 'srv-gw-01', 'Redis 7',
         NOW() - INTERVAL 45 DAY
  UNION ALL
  SELECT 17, 'Data Migration Tool', 'Tools', 'deprecated', 'staging',
         'https://migrate.example.com', 'Data Team', '1.0.0', 100,
         'Tool migrasi data antar database.', 'srv-mig-01', 'Various',
         NOW() - INTERVAL 50 DAY
) AS v
JOIN categories c ON c.name = v.category
ON DUPLICATE KEY UPDATE id = id;

-- ------------------------------------------------------------
-- 3. TECH STACK — semua relasi app_tech (idempotent)
-- ------------------------------------------------------------
INSERT INTO app_tech (app_id, tech)
SELECT a.id, t.tech
FROM apps a
JOIN (
  SELECT 'Sistem Informasi Kepegawaian' AS app_name, 'Laravel' AS tech
  UNION ALL SELECT 'Sistem Informasi Kepegawaian', 'MySQL'
  UNION ALL SELECT 'Sistem Informasi Kepegawaian', 'Bootstrap'
  UNION ALL SELECT 'E-Office', 'React'
  UNION ALL SELECT 'E-Office', 'Node.js'
  UNION ALL SELECT 'E-Office', 'PostgreSQL'
  UNION ALL SELECT 'Dashboard Monitoring', 'Vue.js'
  UNION ALL SELECT 'Dashboard Monitoring', 'Express'
  UNION ALL SELECT 'Dashboard Monitoring', 'MongoDB'
  UNION ALL SELECT 'E-Learning', 'Next.js'
  UNION ALL SELECT 'E-Learning', 'Firebase'
  UNION ALL SELECT 'E-Learning', 'Tailwind'
  UNION ALL SELECT 'Helpdesk System', 'PHP'
  UNION ALL SELECT 'Helpdesk System', 'MariaDB'
  UNION ALL SELECT 'Helpdesk System', 'jQuery'
  UNION ALL SELECT 'Inventory Management', 'Django'
  UNION ALL SELECT 'Inventory Management', 'PostgreSQL'
  UNION ALL SELECT 'Inventory Management', 'Bootstrap'
  UNION ALL SELECT 'Portal Alumni', 'Laravel'
  UNION ALL SELECT 'Portal Alumni', 'MySQL'
  UNION ALL SELECT 'Portal Alumni', 'Alpine.js'
  UNION ALL SELECT 'Sistem Pengadaan', 'Java'
  UNION ALL SELECT 'Sistem Pengadaan', 'PostgreSQL'
  UNION ALL SELECT 'Sistem Pengadaan', 'Spring Boot'
  UNION ALL SELECT 'E-Presensi', 'React Native'
  UNION ALL SELECT 'E-Presensi', 'Node.js'
  UNION ALL SELECT 'E-Presensi', 'MongoDB'
  UNION ALL SELECT 'Data Warehouse', 'Python'
  UNION ALL SELECT 'Data Warehouse', 'Redshift'
  UNION ALL SELECT 'Data Warehouse', 'Looker'
  UNION ALL SELECT 'Project Management', 'React'
  UNION ALL SELECT 'Project Management', 'GraphQL'
  UNION ALL SELECT 'Project Management', 'PostgreSQL'
  UNION ALL SELECT 'Knowledge Base', 'Vue.js'
  UNION ALL SELECT 'Knowledge Base', 'Laravel'
  UNION ALL SELECT 'Knowledge Base', 'Elasticsearch'
  UNION ALL SELECT 'CRM System', 'Angular'
  UNION ALL SELECT 'CRM System', 'Node.js'
  UNION ALL SELECT 'CRM System', 'PostgreSQL'
  UNION ALL SELECT 'E-Commerce Platform', 'Next.js'
  UNION ALL SELECT 'E-Commerce Platform', 'Prisma'
  UNION ALL SELECT 'E-Commerce Platform', 'PostgreSQL'
  UNION ALL SELECT 'Sistem Keuangan', 'Spring Boot'
  UNION ALL SELECT 'Sistem Keuangan', 'MySQL'
  UNION ALL SELECT 'Sistem Keuangan', 'Angular'
  UNION ALL SELECT 'API Gateway', 'Kong'
  UNION ALL SELECT 'API Gateway', 'Redis'
  UNION ALL SELECT 'API Gateway', 'Lua'
  UNION ALL SELECT 'Data Migration Tool', 'Python'
  UNION ALL SELECT 'Data Migration Tool', 'SQLAlchemy'
  UNION ALL SELECT 'Data Migration Tool', 'CLI'
) AS t ON t.app_name = a.name
ON DUPLICATE KEY UPDATE app_id = app_id;

COMMIT;

-- ------------------------------------------------------------
-- 3. SINKRON AUTO_INCREMENT — seed memakai id eksplisit (1-17)
--    yang TIDAK menggerakkan AUTO_INCREMENT MySQL. Tanpa ini
--    INSERT baru menabrak id yang sudah ada (error 1062).
-- ------------------------------------------------------------
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

-- ============================================================
-- VERIFIKASI
-- ============================================================
SELECT COUNT(*) AS total_apps FROM apps;
SELECT COUNT(*) AS total_kategori FROM categories;
SELECT COUNT(*) AS total_tech FROM app_tech;
