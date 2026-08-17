-- ============================================================
-- MIGRASI 01 — Seed dummy data lengkap (aplikasi, kategori, tech)
-- Database : PostgreSQL / Supabase
--
-- Isi:
--   1. Pastikan 16 kategori ada (idempotent)
--   2. Masukkan SEMUA 17 aplikasi dummy (id mengikuti APP_DATA
--      di src/data/initialData.ts) + relasi app_tech
--
-- Aman dijalankan berulang (idempotent): baris yang sudah ada
-- akan dilewati (ON CONFLICT DO NOTHING). Tidak menghapus data.
--
-- KONVENSI: file ini dipasangkan dengan
--   migrations/mysql/01_seed_dummy_data.sql
-- Jalankan via Supabase SQL Editor SETELAH schema.supabase.sql.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. KATEGORI — pastikan semuanya ada (16 kategori default)
-- ------------------------------------------------------------
INSERT INTO categories (name) VALUES
  ('HRIS'), ('Office'), ('Monitoring'), ('Education'),
  ('Support'), ('Inventory'), ('Community'), ('Procurement'),
  ('Analytics'), ('Management'), ('Content'), ('CRM'),
  ('E-Commerce'), ('Finance'), ('Infrastructure'), ('Tools')
ON CONFLICT (name) DO NOTHING;

-- ------------------------------------------------------------
-- 2. APLIKASI — 17 dummy app.
--    Kolom server/database yang kosong diisi NULL.
--    Alias kolom "db" karena nama kolom target "database".
-- ------------------------------------------------------------
INSERT INTO apps (id, name, category_id, status, env, url, owner, version, progress, description, server, database, created_at)
SELECT v.id, v.name, c.id, v.status, v.env, v.url, v.owner, v.version, v.progress, v.description, v.server, v.db, v.created_at
FROM (VALUES
  (1,  'Sistem Informasi Kepegawaian', 'HRIS',          'active',      'production', 'https://sik.example.com',        'Dinas Kominfo',     '3.2.1', 95,  'Sistem untuk manajemen data pegawai dan kehadiran.',        'srv-hris-01',  'MySQL 8.0',       NOW() - INTERVAL '1 day'),
  (2,  'E-Office',                    'Office',         'active',      'production', 'https://eoffice.example.com',    'Bagian Umum',       '2.0.0', 100, 'Aplikasi surat menyurat dan disposisi digital.',             'srv-eof-01',   'PostgreSQL 15',   NOW() - INTERVAL '2 days'),
  (3,  'Dashboard Monitoring',        'Monitoring',     'active',      'production', 'https://monitor.example.com',    'IT Support',        '1.5.0', 80,  'Monitoring real-time server dan aplikasi.',                  'srv-mon-01',   'MongoDB 6',       NOW() - INTERVAL '3 days'),
  (4,  'E-Learning',                  'Education',      'maintenance', 'staging',    'https://elearning.example.com',  'Dinas Pendidikan',  '4.1.2', 70,  'Platform pembelajaran online untuk siswa dan guru.',         'srv-learn-01', 'Firebase',        NOW() - INTERVAL '4 days'),
  (5,  'Helpdesk System',             'Support',        'active',      'production', 'https://helpdesk.example.com',   'IT Service',        '2.3.0', 90,  'Sistem tiket untuk layanan helpdesk internal.',              'srv-hd-01',    'MariaDB 10',      NOW() - INTERVAL '5 days'),
  (6,  'Inventory Management',        'Inventory',      'inactive',    'development','https://inventory.example.com',  'Logistik',          '1.0.0', 30,  'Manajemen inventaris barang dan aset.',                      'srv-inv-dev',  'PostgreSQL 14',   NOW() - INTERVAL '9 days'),
  (7,  'Portal Alumni',               'Community',      'active',      'production', 'https://alumni.example.com',     'Hubungan Alumni',   '3.0.1', 85,  'Portal untuk komunikasi dan jaringan alumni.',               'srv-alumni-01','MySQL 8.0',       NOW() - INTERVAL '10 days'),
  (8,  'Sistem Pengadaan',            'Procurement',    'deprecated',  'staging',    'https://pengadaan.example.com',  'Bagian Pengadaan',  '1.2.0', 100, 'Aplikasi untuk proses pengadaan barang dan jasa.',           'srv-proc-01',  'PostgreSQL 13',   NOW() - INTERVAL '11 days'),
  (9,  'E-Presensi',                  'HRIS',           'active',      'production', 'https://presensi.example.com',    'HRD',               '2.1.0', 75,  'Sistem presensi berbasis web dan mobile.',                   'srv-pres-01',  NULL,              NOW() - INTERVAL '12 days'),
  (10, 'Data Warehouse',              'Analytics',      'active',      'production', 'https://dw.example.com',          'Data Team',         '1.0.0', 60,  'Penyimpanan dan analisis data terpusat.',                    NULL,           'Redshift',        NOW() - INTERVAL '20 days'),
  (11, 'Project Management',          'Management',     'active',      'production', 'https://pm.example.com',          'PMO',               '4.0.0', 95,  'Manajemen proyek dan tugas tim.',                            'srv-pm-01',    'PostgreSQL 15',   NOW() - INTERVAL '21 days'),
  (12, 'Knowledge Base',              'Content',        'maintenance', 'staging',    'https://kb.example.com',          'Knowledge Management', '2.2.0', 65, 'Basis pengetahuan perusahaan.',                               'srv-kb-01',    'Elasticsearch 8', NOW() - INTERVAL '25 days'),
  (13, 'CRM System',                  'CRM',            'inactive',    'development','https://crm.example.com',         'Sales & Marketing', '0.9.0', 45,  'Customer relationship management.',                           'srv-crm-dev',  'PostgreSQL 14',   NOW() - INTERVAL '30 days'),
  (14, 'E-Commerce Platform',         'E-Commerce',     'active',      'production', 'https://shop.example.com',        'Digital Business',  '5.1.0', 88,  'Platform penjualan online.',                                 'srv-shop-01',  'PostgreSQL 15',   NOW() - INTERVAL '35 days'),
  (15, 'Sistem Keuangan',             'Finance',        'active',      'production', 'https://finance.example.com',     'Keuangan',          '3.0.0', 92,  'Manajemen keuangan dan akuntansi.',                          'srv-fin-01',   'MySQL 8.0',       NOW() - INTERVAL '40 days'),
  (16, 'API Gateway',                 'Infrastructure', 'active',      'production', 'https://api.example.com',         'DevOps',            '2.4.0', 78,  'Gateway untuk microservices.',                                'srv-gw-01',    'Redis 7',         NOW() - INTERVAL '45 days'),
  (17, 'Data Migration Tool',         'Tools',          'deprecated',  'staging',    'https://migrate.example.com',     'Data Team',         '1.0.0', 100, 'Tool migrasi data antar database.',                           'srv-mig-01',   'Various',         NOW() - INTERVAL '50 days')
) AS v(id, name, category, status, env, url, owner, version, progress, description, server, db, created_at)
JOIN categories c ON c.name = v.category
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- 3. TECH STACK — semua relasi app_tech (idempotent)
-- ------------------------------------------------------------
INSERT INTO app_tech (app_id, tech)
SELECT a.id, t.tech
FROM apps a
JOIN (VALUES
  ('Sistem Informasi Kepegawaian', 'Laravel'),
  ('Sistem Informasi Kepegawaian', 'MySQL'),
  ('Sistem Informasi Kepegawaian', 'Bootstrap'),
  ('E-Office',                     'React'),
  ('E-Office',                     'Node.js'),
  ('E-Office',                     'PostgreSQL'),
  ('Dashboard Monitoring',         'Vue.js'),
  ('Dashboard Monitoring',         'Express'),
  ('Dashboard Monitoring',         'MongoDB'),
  ('E-Learning',                   'Next.js'),
  ('E-Learning',                   'Firebase'),
  ('E-Learning',                   'Tailwind'),
  ('Helpdesk System',              'PHP'),
  ('Helpdesk System',              'MariaDB'),
  ('Helpdesk System',              'jQuery'),
  ('Inventory Management',         'Django'),
  ('Inventory Management',         'PostgreSQL'),
  ('Inventory Management',         'Bootstrap'),
  ('Portal Alumni',                'Laravel'),
  ('Portal Alumni',                'MySQL'),
  ('Portal Alumni',                'Alpine.js'),
  ('Sistem Pengadaan',             'Java'),
  ('Sistem Pengadaan',             'PostgreSQL'),
  ('Sistem Pengadaan',             'Spring Boot'),
  ('E-Presensi',                   'React Native'),
  ('E-Presensi',                   'Node.js'),
  ('E-Presensi',                   'MongoDB'),
  ('Data Warehouse',               'Python'),
  ('Data Warehouse',               'Redshift'),
  ('Data Warehouse',               'Looker'),
  ('Project Management',           'React'),
  ('Project Management',           'GraphQL'),
  ('Project Management',           'PostgreSQL'),
  ('Knowledge Base',               'Vue.js'),
  ('Knowledge Base',               'Laravel'),
  ('Knowledge Base',               'Elasticsearch'),
  ('CRM System',                   'Angular'),
  ('CRM System',                   'Node.js'),
  ('CRM System',                   'PostgreSQL'),
  ('E-Commerce Platform',          'Next.js'),
  ('E-Commerce Platform',          'Prisma'),
  ('E-Commerce Platform',          'PostgreSQL'),
  ('Sistem Keuangan',              'Spring Boot'),
  ('Sistem Keuangan',              'MySQL'),
  ('Sistem Keuangan',              'Angular'),
  ('API Gateway',                  'Kong'),
  ('API Gateway',                  'Redis'),
  ('API Gateway',                  'Lua'),
  ('Data Migration Tool',          'Python'),
  ('Data Migration Tool',          'SQLAlchemy'),
  ('Data Migration Tool',          'CLI')
) AS t(app_name, tech) ON t.app_name = a.name
ON CONFLICT (app_id, tech) DO NOTHING;

COMMIT;

-- ------------------------------------------------------------
-- 4. SINKRON SEQUENCE — seed memakai id eksplisit (1-17) yang
--    TIDAK menggerakkan sequence otomatis PostgreSQL. Tanpa ini
--    INSERT baru menabrak id yang sudah ada (error 500:
--    "duplicate key value violates unique constraint apps_pkey").
-- ------------------------------------------------------------
SELECT setval(pg_get_serial_sequence('apps', 'id'), (SELECT COALESCE(MAX(id), 0) FROM apps), true);
SELECT setval(pg_get_serial_sequence('categories', 'id'), (SELECT COALESCE(MAX(id), 0) FROM categories), true);
SELECT setval(pg_get_serial_sequence('admins', 'id'), (SELECT COALESCE(MAX(id), 0) FROM admins), true);

-- ============================================================
-- VERIFIKASI
-- ============================================================
SELECT COUNT(*) AS total_apps FROM apps;
SELECT COUNT(*) AS total_kategori FROM categories;
SELECT COUNT(*) AS total_tech FROM app_tech;
