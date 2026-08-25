"use client";

/* Penjelajah katalog publik: pencarian + filter kategori/status/teknologi.
 *
 * Dua keputusan penting:
 *
 * 1. HIDRASI. Filter awal datang sebagai PROPS dari server (dibaca dari
 *    searchParams di page.tsx), bukan dibaca dari `window.location` saat
 *    render. Jadi render server dan render klien pertama identik — sesuai
 *    aturan emas di CLAUDE.md:27. Tautan berfilter yang dibagikan pun sudah
 *    tampil terfilter pada frame pertama, tanpa kedip.
 *
 * 2. SINKRONISASI URL memakai `window.history.replaceState`, BUKAN
 *    `router.replace`. Penyaringan sudah terjadi di klien atas data yang
 *    sudah tertanam; `router.replace` akan memicu pengambilan ulang payload
 *    RSC pada setiap ketikan — mahal dan terasa tersendat. replaceState
 *    hanya memperbarui alamat di address bar, sehingga URL tetap bisa
 *    dibagikan tanpa satu pun perjalanan ke server.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { PublicApp } from '@/types';
import type { PublicCategory } from '@/lib/public';
import { PUBLIC_STATUS_OPTIONS } from '@/lib/appMeta';
import PublicAppCard from './PublicAppCard';
import SearchAutocomplete from '@/components/SearchAutocomplete';

export interface CatalogFilters {
  q: string;
  kategori: string;
  status: string;
  teknologi: string;
}

interface Props {
  apps: PublicApp[];
  categories: PublicCategory[];
  technologies: string[];
  initial: CatalogFilters;
}

const PAGE_SIZE = 12;

const chipBase =
  'inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border text-xs font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-slate-900 cursor-pointer';
const chipInactive =
  'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 hover:text-blue-600 dark:hover:text-blue-400';
const chipActive = 'bg-blue-600 text-white border-transparent';
const hideScrollbar =
  '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';
const selectClass =
  'h-9 appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-3 pr-8 text-xs text-slate-700 dark:text-slate-200 outline-none transition-shadow focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 cursor-pointer';

export default function CatalogBrowser({ apps, categories, technologies, initial }: Props) {
  const [q, setQ] = useState(initial.q);
  const [kategori, setKategori] = useState(initial.kategori);
  const [status, setStatus] = useState(initial.status);
  const [teknologi, setTeknologi] = useState(initial.teknologi);
  const [page, setPage] = useState(1);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return apps.filter((app) => {
      if (kategori !== 'all' && app.category !== kategori) return false;
      if (status !== 'all' && app.status !== status) return false;
      if (teknologi !== 'all' && !app.tech.includes(teknologi)) return false;
      if (term) {
        const haystack = `${app.name} ${app.description} ${app.owner ?? ''} ${app.tech.join(' ')}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [apps, q, kategori, status, teknologi]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageApps = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const hasFilters =
    q !== '' || kategori !== 'all' || status !== 'all' || teknologi !== 'all';

  const clearFilters = () => {
    setQ('');
    setKategori('all');
    setStatus('all');
    setTeknologi('all');
    setPage(1);
  };

  // Kembali ke halaman 1 setiap filter berubah.
  useEffect(() => {
    setPage(1); // eslint-disable-line react-hooks/set-state-in-effect
  }, [q, kategori, status, teknologi]);

  // Cerminkan keadaan filter ke URL (debounce) supaya bisa dibagikan.
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (kategori !== 'all') params.set('kategori', kategori);
      if (status !== 'all') params.set('status', status);
      if (teknologi !== 'all') params.set('teknologi', teknologi);
      const query = params.toString();
      const next = query ? `/katalog?${query}` : '/katalog';
      if (`${window.location.pathname}${window.location.search}` !== next) {
        window.history.replaceState(null, '', next);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [q, kategori, status, teknologi]);

  // Ctrl/⌘+K memfokuskan pencarian — pola yang sama seperti AppsPage.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const pageItems = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const set = new Set([1, 2, safePage - 1, safePage, safePage + 1, totalPages - 1, totalPages]);
    const nums = Array.from(set).filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
    const items: (number | 'ellipsis')[] = [];
    for (let i = 0; i < nums.length; i++) {
      if (i > 0 && nums[i] - nums[i - 1] > 1) items.push('ellipsis');
      items.push(nums[i]);
    }
    return items;
  }, [totalPages, safePage]);

  return (
    <div className="space-y-5">
      {/* Pencarian */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <SearchAutocomplete
          items={apps.map((a) => a.name)}
          getLabel={(x) => x}
          value={q}
          onChange={setQ}
          placeholder="Cari aplikasi, unit kerja, atau teknologi…"
          ariaLabel="Cari aplikasi"
          inputRef={searchRef}
          className="w-full lg:max-w-md"
        />
        <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
          {filtered.length} dari {apps.length} aplikasi
        </p>
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="lg:ml-auto inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-700 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <i className="fas fa-xmark text-[10px]"></i>
            Hapus filter
          </button>
        )}
      </div>

      {/* Filter kategori (chip) + status/teknologi (select) */}
      <div className="space-y-3">
        <div className={`flex items-center gap-2 overflow-x-auto pb-1 ${hideScrollbar}`}>
          <button
            type="button"
            onClick={() => setKategori('all')}
            aria-pressed={kategori === 'all'}
            className={`${chipBase} ${kategori === 'all' ? chipActive : chipInactive}`}
          >
            Semua Kategori
            <span className="tabular-nums opacity-70">{apps.length}</span>
          </button>
          {categories.map((c) => (
            <button
              key={c.name}
              type="button"
              onClick={() => setKategori(c.name)}
              aria-pressed={kategori === c.name}
              className={`${chipBase} ${kategori === c.name ? chipActive : chipInactive}`}
            >
              {c.name}
              <span className="tabular-nums opacity-70">{c.count}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={selectClass}
              aria-label="Filter status"
            >
              {PUBLIC_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.value === 'all' ? 'Semua Status' : opt.label}
                </option>
              ))}
            </select>
            <i className="fas fa-chevron-down absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none"></i>
          </div>
          <div className="relative">
            <select
              value={teknologi}
              onChange={(e) => setTeknologi(e.target.value)}
              className={selectClass}
              aria-label="Filter teknologi"
            >
              <option value="all">Semua Teknologi</option>
              {technologies.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <i className="fas fa-chevron-down absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none"></i>
          </div>
        </div>
      </div>

      {/* Hasil */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 py-14 px-6 text-center">
          <div className="mx-auto w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
            <i className="fas fa-search text-sm"></i>
          </div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {apps.length === 0 ? 'Belum ada aplikasi yang dipublikasikan' : 'Tidak ada aplikasi yang cocok'}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            {apps.length === 0
              ? 'Katalog akan terisi begitu pengelola menerbitkan aplikasi.'
              : 'Coba ubah kata kunci atau hapus sebagian filter.'}
          </p>
          {hasFilters && apps.length > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
            >
              <i className="fas fa-xmark text-[10px]"></i>
              Hapus filter
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {pageApps.map((app) => (
            <PublicAppCard key={app.id} app={app} />
          ))}
        </div>
      )}

      {/* Paginasi */}
      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-1 pt-2" aria-label="Halaman katalog">
          <button
            type="button"
            onClick={() => setPage(Math.max(1, safePage - 1))}
            disabled={safePage === 1}
            className="px-2.5 py-1.5 rounded-md text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label="Halaman sebelumnya"
          >
            <i className="fas fa-chevron-left text-[10px]"></i>
          </button>
          {pageItems.map((item, i) =>
            item === 'ellipsis' ? (
              <span key={`e${i}`} className="px-2 text-xs text-slate-400">
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => setPage(item)}
                aria-current={item === safePage ? 'page' : undefined}
                className={`min-w-8 px-2.5 py-1.5 rounded-md text-xs tabular-nums transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  item === safePage
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {item}
              </button>
            )
          )}
          <button
            type="button"
            onClick={() => setPage(Math.min(totalPages, safePage + 1))}
            disabled={safePage === totalPages}
            className="px-2.5 py-1.5 rounded-md text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label="Halaman berikutnya"
          >
            <i className="fas fa-chevron-right text-[10px]"></i>
          </button>
        </nav>
      )}
    </div>
  );
}
