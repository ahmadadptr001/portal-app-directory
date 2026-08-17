"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import SearchAutocomplete from '@/components/SearchAutocomplete';

const categories = [
  { icon: 'fa-rocket', title: 'Memulai', desc: 'Login, sesi admin, dan keluar dari portal.' },
  { icon: 'fa-boxes-stacked', title: 'Manajemen Aplikasi', desc: 'Tambah, edit, hapus, dan kelola status aplikasi.' },
  { icon: 'fa-tags', title: 'Kategori & Teknologi', desc: 'Organisir aplikasi dengan kategori dan teknologi.' },
  { icon: 'fa-shield-halved', title: 'Data & Keamanan', desc: 'Penyimpanan di database, backup/restore, dan keamanan akun.' },
];

const faqs = [
  { q: 'Bagaimana cara menambahkan aplikasi baru?', a: 'Buka halaman Daftar Aplikasi dari sidebar, lalu klik tombol Tambah. Isi nama, pilih kategori dari daftar (atau biarkan Uncategorized), pilih status dan lingkungan, centang tech stack dari daftar teknologi (atau ketik nama baru lalu tekan Enter), lalu klik Simpan. Aplikasi langsung tersimpan di database dan muncul di daftar.', cat: 'Manajemen Aplikasi' },
  { q: 'Apa arti status pada aplikasi?', a: 'Active: aplikasi berjalan normal. Maintenance: sedang dalam pemeliharaan. Inactive: tidak aktif sementara. Deprecated: sudah dihentikan. Status memengaruhi notifikasi dan tampilan kartu di halaman aplikasi.', cat: 'Manajemen Aplikasi' },
  { q: 'Bagaimana cara mengubah tema gelap/terang?', a: 'Klik avatar di pojok kanan atas, lalu gunakan sakelar Mode Gelap / Mode Terang di menu profil. Cara lain: buka halaman Pengaturan → Preferensi Tampilan. Pilihan tema tersimpan otomatis di browser.', cat: 'Memulai' },
  { q: 'Bagaimana cara mengelola kategori?', a: 'Buka halaman Kategori melalui sidebar. Anda dapat menambah, mengganti nama, atau menghapus kategori. Saat kategori dihapus, aplikasi di dalamnya dipindah ke Uncategorized. Ikon dan warna kartu kategori disimpan di browser.', cat: 'Kategori & Teknologi' },
  { q: 'Bagaimana cara mengelola teknologi?', a: 'Buka halaman Teknologi melalui sidebar. Di sana Anda dapat menambah teknologi baru (klik Tambah Teknologi), mengganti nama (perubahan otomatis berlaku ke semua aplikasi yang memakainya), atau menghapusnya. Teknologi yang baru ditambahkan tersimpan di browser dan langsung muncul di pilihan Tech Stack form aplikasi; begitu dipakai oleh sebuah aplikasi, ia tersimpan permanen di database. Nama teknologi baru juga bisa diketik langsung di kolom Tech Stack form aplikasi.', cat: 'Kategori & Teknologi' },
  { q: 'Bagaimana cara login ke portal?', a: 'Login memakai username dan password akun admin yang terdaftar di database. Setelah login, sesi berlaku 7 hari; pilih Keluar di menu profil untuk mengakhiri lebih awal.', cat: 'Memulai' },
  { q: 'Di mana data aplikasi disimpan? Apakah aman?', a: 'Data aplikasi, kategori, dan teknologi disimpan di database server — bukan di browser — dan perubahan dari tab lain tampil otomatis (realtime, atau polling setiap 10 detik pada mode MySQL/Laragon). Yang disimpan di browser hanya preferensi tampilan (tema, tampilan grid/list, ikon kategori) dan snapshot cadangan bila Anda menjalankan Backup. Akses diatur lewat login admin dengan sesi 7 hari, dan password disimpan terenkripsi (bcrypt).', cat: 'Data & Keamanan' },
  { q: 'Bagaimana cara menghapus aplikasi?', a: 'Klik kartu aplikasi untuk membuka panel detail, lalu klik tombol Hapus dan konfirmasi. Perubahan langsung diterapkan ke database dan tidak dapat dibatalkan.', cat: 'Manajemen Aplikasi' },
  { q: 'Bisakah saya mengubah profil pengguna?', a: 'Ya. Buka halaman Pengaturan → Profil Admin untuk mengganti username atau password. Password baru minimal 6 karakter.', cat: 'Data & Keamanan' },
  { q: 'Bagaimana cara mem-backup atau memindahkan data?', a: 'Buka halaman Pengaturan → Manajemen Data. Backup menyimpan snapshot data di browser, Export JSON mengunduh seluruh data sebagai file, dan Import/Restore memulihkan dari file JSON (menggantikan seluruh data saat ini). Gunakan Hapus Semua Data hanya jika yakin ingin mengosongkan semuanya.', cat: 'Data & Keamanan' },
  { q: 'Bagaimana cara keluar dari portal?', a: 'Klik avatar di pojok kanan atas, pilih Keluar, lalu konfirmasi. Sesi diakhiri dan Anda perlu login kembali untuk mengakses portal.', cat: 'Memulai' },
];

function scrollToFaq() {
  const el = document.getElementById('faq');
  if (!el) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}

export default function HelpPage() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<string | null>(null);
  const router = useRouter();

  const q = search.trim().toLowerCase();
  const filteredFaqs = faqs.filter((f) => {
    const matchesSearch = !q || f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q);
    const matchesCat = !filterCat || f.cat === filterCat;
    return matchesSearch && matchesCat;
  });

  const toggleCat = (title: string) => {
    setFilterCat((cur) => (cur === title ? null : title));
    scrollToFaq();
  };

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-3 px-4 sm:px-6">
          <button
            onClick={() => router.back()}
            aria-label="Kembali"
            title="Kembali"
            className="-ml-2 flex h-9 w-9 items-center justify-center rounded-lg text-ink-2 transition-colors duration-150 hover:bg-paper-2 hover:text-ink active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <i className="fas fa-chevron-left text-sm"></i>
          </button>
          <div className="min-w-0">
            <p className="mb-0.5 text-[10px] font-semibold uppercase leading-none tracking-[0.18em] text-accent">
              Portal Direktori Aplikasi
            </p>
            <h1 className="truncate text-base font-bold tracking-tight text-ink">Pusat Bantuan</h1>
          </div>
          <span className="ml-auto hidden rounded-md border border-line px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-3 sm:inline-flex">
            /help
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pb-20 sm:px-6">
        {/* Lead + pencarian */}
        <section className="border-b border-line pb-12 pt-14 sm:pt-20">
          <h2 className="text-3xl font-bold leading-[1.15] tracking-tight text-ink sm:text-4xl">
            Ada yang bisa kami bantu?
          </h2>
          <p className="mt-3 max-w-prose text-sm text-ink-2 sm:text-base">
            Cari artikel bantuan atau pilih salah satu topik di bawah ini.
          </p>
          <div className="mt-8 max-w-xl">
            <SearchAutocomplete
              items={faqs.map((f) => f.q)}
              getLabel={(qq) => qq}
              value={search}
              onChange={(v) => {
                setSearch(v);
                setFilterCat(null);
              }}
              onSelect={() => scrollToFaq()}
              placeholder="Ketik kata kunci — mis. backup, status, kategori..."
              maxSuggestions={8}
            />
          </div>
          <p className="mt-3 text-xs text-ink-3">
            {faqs.length} pertanyaan umum · {categories.length} topik
          </p>
        </section>

        {/* Index topik — kartu berfungsi sebagai filter FAQ */}
        <section className="grid gap-x-8 sm:grid-cols-2" aria-label="Topik bantuan">
          {categories.map((cat) => {
            const active = filterCat === cat.title;
            return (
              <button
                key={cat.title}
                type="button"
                onClick={() => toggleCat(cat.title)}
                aria-pressed={active}
                className={`group border-t py-6 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                  active ? 'border-accent' : 'border-line hover:border-accent/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-150 ${
                      active ? 'bg-accent text-white' : 'bg-accent-soft text-accent group-hover:bg-accent/15'
                    }`}
                  >
                    <i className={`fas ${cat.icon} text-sm`}></i>
                  </span>
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors duration-150 ${
                      active ? 'text-accent' : 'text-ink-3 group-hover:text-accent'
                    }`}
                  >
                    {cat.title}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-ink-2">{cat.desc}</p>
              </button>
            );
          })}
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 pt-16 sm:pt-20">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-ink">
                Pertanyaan yang Sering Diajukan
              </h2>
              <p className="mt-1.5 text-sm text-ink-2">Temukan jawaban cepat untuk pertanyaan umum.</p>
            </div>
            {filterCat && (
              <button
                type="button"
                onClick={() => setFilterCat(null)}
                className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-xs font-medium text-ink-2 transition-colors duration-150 hover:border-accent/60 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <i className="fas fa-xmark text-[10px]"></i>
                Filter: {filterCat}
              </button>
            )}
          </div>

          {filteredFaqs.length === 0 ? (
            <div className="py-16 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
                <i className="fas fa-magnifying-glass text-lg"></i>
              </div>
              <p className="mt-4 text-sm text-ink-2">
                Tidak ada hasil untuk &quot;{search || filterCat}&quot;.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setFilterCat(null);
                }}
                className="mt-4 text-xs font-semibold text-accent underline-offset-4 transition-colors duration-150 hover:text-accent-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                Hapus pencarian &amp; filter
              </button>
            </div>
          ) : (
            <div className="mt-8">
              {filteredFaqs.map((faq, index) => {
                const isOpen = activeIndex === index;
                return (
                  <div key={index} className="border-b border-line">
                    <button
                      type="button"
                      onClick={() => setActiveIndex(isOpen ? null : index)}
                      aria-expanded={isOpen}
                      className="group flex w-full items-center justify-between gap-4 py-5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    >
                      <span className="text-sm font-medium text-ink transition-colors duration-150 group-hover:text-accent">
                        {faq.q}
                      </span>
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line text-ink-3 transition-transform duration-200 ease-hm ${
                          isOpen ? 'rotate-180 border-accent/60 text-accent' : ''
                        }`}
                      >
                        <i className="fas fa-chevron-down text-[10px]"></i>
                      </span>
                    </button>
                    {isOpen && (
                      <div className="hm-rise pb-5">
                        <p className="border-l-2 border-accent/60 pl-4 text-sm leading-relaxed text-ink-2">{faq.a}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* CTA */}
        <section className="pt-16">
          <div className="flex flex-col gap-6 rounded-xl border border-line bg-paper-2 p-8 sm:flex-row sm:items-center sm:justify-between sm:p-10">
            <div className="min-w-0">
              <h2 className="text-xl font-bold tracking-tight text-ink">Masih ada yang belum jelas?</h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-2">
                Kembali ke dashboard dan coba langsung — semua data aman di database server.
              </p>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2.5 rounded-lg bg-accent px-5 text-sm font-semibold text-white transition-[background-color,transform] duration-150 ease-hm hover:bg-accent-2 active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <i className="fas fa-arrow-right text-xs"></i>
              Kembali ke Dashboard
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
