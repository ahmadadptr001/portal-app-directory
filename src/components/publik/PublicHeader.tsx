"use client";

/* Header portal publik.
 *
 * Tiga lapis, bukan satu baris datar: (1) strip identitas pemerintah,
 * (2) baris utama dengan lambang + wordmark dua baris, (3) navigasi dengan
 * garis indikator yang tumbuh dari kiri.
 *
 * TIDAK ADA tautan "Masuk Admin" di sini — sengaja. Portal publik tidak perlu
 * mengiklankan pintu masuk pengelolanya; admin cukup membuka /login langsung.
 * Selain lebih rapi, ini juga mengurangi permukaan yang menarik percobaan
 * masuk paksa.
 */
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { APP_NAME, GOV_NAME } from '@/lib/branding';

const NAV = [
  { href: '/', label: 'Beranda' },
  { href: '/katalog', label: 'Katalog' },
];

export default function PublicHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  // Bayangan muncul hanya setelah halaman digulir — dibaca di effect, bukan
  // saat render, sesuai aturan hidrasi di CLAUDE.md.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Tutup menu mobile setiap pindah halaman.
  useEffect(() => {
    setOpen(false); // eslint-disable-line react-hooks/set-state-in-effect
  }, [pathname]);

  /**
   * Tukar tombol "Masuk" menjadi "Dashboard" bila admin sedang login.
   *
   * Statusnya ditanyakan ke /api/session-hint SETELAH mount, bukan dibaca
   * sebagai cookie di server. Alasannya arsitektural: cookie `admin_session`
   * bersifat httpOnly (tidak terbaca JavaScript), dan membacanya di Server
   * Component akan membuat halaman publik menjadi dinamis — membatalkan
   * `revalidate = 300` yang justru menahan beban trafik publik. Menukar satu
   * label tombol tidak layak dibayar dengan kehilangan cache seluruh halaman.
   *
   * Konsekuensinya tombol tampil "Masuk" sekejap sebelum berubah. Itu memang
   * pertukarannya — dan render server & render klien pertama sama-sama
   * "Masuk", jadi tidak ada mismatch hidrasi.
   */
  useEffect(() => {
    let alive = true;
    fetch('/api/session-hint')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d?.loggedIn) setLoggedIn(true);
      })
      .catch(() => {
        // Gagal menanyakan status bukan hal kritis — biarkan "Masuk".
      });
    return () => {
      alive = false;
    };
  }, []);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header
      className={`sticky top-0 z-40 bg-white dark:bg-slate-900 transition-shadow duration-200 ${
        scrolled ? 'shadow-sm' : ''
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Lambang di kiri, SELURUH sisanya di kanan: menu navigasi, lalu
            tombol Bantuan (tanpa latar) dan Masuk (berlatar warna aksen). */}
        <div className="flex items-center justify-between h-[68px] gap-4">
          <Link
            href="/"
            className="flex items-center gap-3 min-w-0 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg"
          >
            {/* Lambang Provinsi Sulawesi Tenggara (aset: public/img/logo-sultra.svg) */}
            {/* eslint-disable-next-line @next/next/no-img-element -- aset SVG lokal kecil, konsisten dengan Sidebar & login */}
            <img
              src="/img/logo-sultra.svg"
              alt=""
              aria-hidden="true"
              className="w-9 h-9 object-contain shrink-0"
            />
            <span className="min-w-0 hidden sm:block">
              <span className="block text-[13px] font-bold text-slate-900 dark:text-slate-50 truncate leading-tight">
                {APP_NAME}
              </span>
              <span className="block text-[10px] text-slate-500 dark:text-slate-400 truncate">
                {GOV_NAME}
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-1 sm:gap-2">
            <nav className="hidden md:flex items-center gap-7 mr-4" aria-label="Navigasi utama">
              {NAV.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded ${
                      active
                        ? 'text-slate-900 dark:text-slate-50 font-semibold'
                        : 'text-slate-600 dark:text-slate-300 font-medium hover:text-slate-900 dark:hover:text-slate-50'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Bantuan — tanpa latar, di kiri pasangan tombol. */}
            <Link
              href="/help"
              className="hidden sm:inline-flex h-10 items-center gap-2 px-3 rounded-md text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <i className="fas fa-circle-question text-[15px]"></i>
              Bantuan
            </Link>

            {/* Masuk / Dashboard — berlatar warna aksen portal (blue-600).
                Berubah menjadi "Dashboard" saat admin sedang login, supaya
                tidak menyuruh orang masuk dua kali. */}
            <Link
              href={loggedIn ? '/dashboard' : '/login'}
              className="inline-flex h-10 items-center gap-2 bg-blue-600 text-white px-4 rounded-md text-sm font-semibold hover:bg-blue-700 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
            >
              <i
                className={`fas ${loggedIn ? 'fa-gauge-high' : 'fa-right-to-bracket'} text-[13px]`}
              ></i>
              {loggedIn ? 'Dashboard' : 'Masuk'}
            </Link>

            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label="Buka menu navigasi"
              className="md:hidden p-2 ml-1 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <i className={`fas ${open ? 'fa-xmark' : 'fa-bars'}`}></i>
            </button>
          </div>
        </div>

        {open && (
          <nav
            className="md:hidden pb-3 flex flex-col gap-1 border-t border-slate-200 dark:border-slate-800 pt-3"
            aria-label="Navigasi utama"
          >
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? 'page' : undefined}
                className={`px-3 py-2.5 rounded-md text-sm font-semibold transition-colors ${
                  isActive(item.href)
                    ? 'text-slate-900 dark:text-slate-50 bg-slate-100 dark:bg-slate-800'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/help"
              className="px-3 py-2.5 rounded-md text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-2.5"
            >
              <i className="fas fa-circle-question text-[15px]"></i>
              Bantuan
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
