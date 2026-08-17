/* Hallmark · component: apps-directory · genre: modern-minimal · accent: indigo
 * redesign: card (rule-top progress · neutral initials tile · status dot) ·
 *           filter (category chip row + status segmented + env select) ·
 *           search (⌘K focus · clear · scoped-to-active-page) ·
 *           status-heat (card terisi setinggi % · warna mengikuti status) ·
 *           pagination (page-size · ellipsis · prev/next · go-to-page · info)
 * states: default · hover · focus-visible · active · empty · disabled
 * responsive: 320/375/414/768 · contrast: pass
 * pre-emit critique: P4 H4 E4 S4 R5 V3
 */
"use client";

import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { App } from '@/types';
import { getCustomTechnologies } from '@/lib/customTech';
import DetailDrawer from './DetailDrawer';
import AddAppModal from './AddAppModal';
import SearchAutocomplete from './SearchAutocomplete';
import { useRealtime } from '@/hooks/useRealtime';

interface AppsPageProps {
  apps: App[];
  categories: string[];
  technologies: string[];
  initialAppId?: number | null;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'Semua' },
  { value: 'active', label: 'Aktif' },
  { value: 'maintenance', label: 'Pemeliharaan' },
  { value: 'inactive', label: 'Nonaktif' },
  { value: 'deprecated', label: 'Dihentikan' },
] as const;

const ENV_OPTIONS = [
  { value: 'all', label: 'Semua Lingkungan' },
  { value: 'production', label: 'Produksi' },
  { value: 'staging', label: 'Staging' },
  { value: 'development', label: 'Development' },
] as const;

const STATUS_DOT: Record<string, string> = {
  active: 'bg-emerald-500',
  maintenance: 'bg-amber-500',
  inactive: 'bg-slate-400 dark:bg-slate-500',
  deprecated: 'bg-rose-500',
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Aktif',
  maintenance: 'Pemeliharaan',
  inactive: 'Nonaktif',
  deprecated: 'Dihentikan',
};

// Warna kartu mengikuti STATUS; tinggi fill mengikuti persentase progres.
function statusStyle(status: string) {
  switch (status) {
    case 'active':
      return { rule: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', fill: 'bg-emerald-500/10 dark:bg-emerald-500/15' };
    case 'maintenance':
      return { rule: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', fill: 'bg-amber-500/10 dark:bg-amber-500/15' };
    case 'deprecated':
      return { rule: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400', fill: 'bg-rose-500/10 dark:bg-rose-500/15' };
    default: // inactive / status tak dikenal
      return { rule: 'bg-slate-400', text: 'text-slate-500 dark:text-slate-400', fill: 'bg-slate-400/10 dark:bg-slate-400/15' };
  }
}

const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').substring(0, 2);

const chipBase = "inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border text-xs font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-slate-900 cursor-pointer";
const chipInactive = "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600 dark:hover:text-indigo-400";
const chipActive = "bg-indigo-600 text-white border-transparent";
const chipCount = "tabular-nums";
const hideScrollbar = "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

export default function AppsPage({ apps, categories, technologies, initialAppId }: AppsPageProps) {
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [envFilter, setEnvFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentView, setCurrentView] = useState<'grid' | 'list'>('grid');
  const [selectedApp, setSelectedApp] = useState<App | null>(null);
  const [localApps, setLocalApps] = useState<App[]>(apps);
  const [localCategories, setLocalCategories] = useState<string[]>(categories);
  const [localTechnologies, setLocalTechnologies] = useState<string[]>(technologies);
  // Teknologi tambahan dari browser (ditambahkan lewat halaman Teknologi).
  const [customTech, setCustomTech] = useState<string[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingApp, setEditingApp] = useState<App | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(9);

  // Ambil ulang data dari database (dipakai oleh realtime & polling).
  const refreshFromServer = useCallback(async () => {
    try {
      const [appsRes, catsRes, techRes] = await Promise.all([
        fetch('/api/apps'),
        fetch('/api/categories'),
        fetch('/api/technologies'),
      ]);
      if (appsRes.ok) {
        const data = await appsRes.json();
        if (Array.isArray(data.apps)) setLocalApps(data.apps);
      }
      if (catsRes.ok) {
        const data = await catsRes.json();
        if (Array.isArray(data.categories)) setLocalCategories(data.categories);
      }
      if (techRes.ok) {
        const data = await techRes.json();
        if (Array.isArray(data.technologies)) setLocalTechnologies(data.technologies);
      }
    } catch (e) {
      console.error('Gagal menyegarkan data aplikasi:', e);
    }
  }, []);

  // Perubahan database (dari tab/admin lain) tampil otomatis.
  useRealtime(refreshFromServer);

  // Simpan ke database via API. Bila DB belum terkonfigurasi (fallback 503),
  // data diperbarui secara lokal saja agar aplikasi tetap bisa dipakai.
  const handleSaveApp = async (newApp: App): Promise<{ ok: boolean; error?: string }> => {
    if (editingApp) {
      try {
        const res = await fetch(`/api/apps/${newApp.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newApp),
        });
        const data = await res.json();
        if (res.ok && data.app) {
          setLocalApps(prev => prev.map(a => a.id === data.app.id ? data.app : a));
          return { ok: true };
        }
        if (res.status === 503) {
          setLocalApps(prev => prev.map(a => a.id === newApp.id ? newApp : a));
          return { ok: true };
        }
        return { ok: false, error: data?.error || 'Gagal menyimpan perubahan' };
      } catch (e) {
        console.error('Gagal memperbarui aplikasi di DB:', e);
        return { ok: false, error: 'Gagal menyimpan perubahan' };
      }
    }

    try {
      const res = await fetch('/api/apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newApp),
      });
      const data = await res.json();
      if (res.ok && data.app) {
        // Dedupe: refetch realtime bisa tiba sebelum respons POST, hindari app ganda.
        setLocalApps(prev => (prev.some(a => a.id === data.app.id) ? prev : [...prev, data.app]));
        return { ok: true };
      }
      if (res.status === 503) {
        setLocalApps(prev => (prev.some(a => a.id === newApp.id) ? prev : [...prev, newApp]));
        return { ok: true };
      }
      return { ok: false, error: data?.error || 'Gagal menambah aplikasi' };
    } catch (e) {
      console.error('Gagal menyimpan aplikasi ke DB:', e);
      return { ok: false, error: 'Gagal menambah aplikasi' };
    }
  };

  const handleDeleteApp = async (id: number) => {
    setSelectedApp(null);
    try {
      await fetch(`/api/apps/${id}`, { method: 'DELETE' });
    } catch (e) {
      console.error('Gagal menghapus aplikasi dari DB:', e);
    }
    setLocalApps(prev => prev.filter(a => a.id !== id));
  };

  // Muat teknologi tambahan dari browser (dari halaman Teknologi).
  useEffect(() => {
    setCustomTech(getCustomTechnologies()); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  useEffect(() => {
    const savedView = localStorage.getItem('app_card_view');
    if (savedView === 'list' || savedView === 'grid') setCurrentView(savedView); // eslint-disable-line react-hooks/set-state-in-effect
    const handleCardViewChange = () => {
      const v = localStorage.getItem('app_card_view');
      if (v === 'list' || v === 'grid') setCurrentView(v);
    };
    window.addEventListener('cardViewChange', handleCardViewChange);
    return () => window.removeEventListener('cardViewChange', handleCardViewChange);
  }, []);

  // Pintasan ⌘K / Ctrl+K untuk fokus ke pencarian.
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

  // Kembali ke halaman 1 setiap filter/ukuran halaman berubah.
  // Catatan: pencarian TIDAK mereset halaman — search sengaja dibatasi
  // ke halaman pagination yang sedang aktif.
  useEffect(() => {
    setCurrentPage(1); // eslint-disable-line react-hooks/set-state-in-effect
  }, [categoryFilter, statusFilter, envFilter, pageSize]);

  // Buka drawer detail langsung saat datang dari halaman Kategori (?app=<id>).
  useEffect(() => {
    if (initialAppId == null) return;
    const t = window.setTimeout(() => {
      setSelectedApp(localApps.find(a => a.id === initialAppId) ?? null);
    }, 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAppId]);

  // Daftar chip kategori dengan jumlah aplikasi (diurutkan paling banyak dulu).
  const categoryChips = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of localApps) counts.set(a.category, (counts.get(a.category) ?? 0) + 1);
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return [
      { name: 'all', label: 'Semua', count: localApps.length },
      ...sorted.map(([name, count]) => ({ name, label: name, count })),
    ];
  }, [localApps]);

  // Daftar teknologi untuk form = database + tambahan dari browser (tanpa dobel).
  const mergedTechnologies = useMemo(
    () => Array.from(new Set([...localTechnologies, ...customTech])),
    [localTechnologies, customTech]
  );

  const setView = (view: 'grid' | 'list') => {
    setCurrentView(view);
    localStorage.setItem('app_card_view', view);
    window.dispatchEvent(new Event('cardViewChange'));
  };

  const hasFilters = categoryFilter !== 'all' || statusFilter !== 'all' || envFilter !== 'all' || searchQuery !== '';
  const clearFilters = () => {
    setCategoryFilter('all');
    setStatusFilter('all');
    setEnvFilter('all');
    setSearchQuery('');
  };

  const filteredApps = localApps.filter(app => {
    if (categoryFilter !== 'all' && app.category !== categoryFilter) return false;
    if (statusFilter !== 'all' && app.status !== statusFilter) return false;
    if (envFilter !== 'all' && app.env !== envFilter) return false;
    if (searchQuery && !app.name.toLowerCase().includes(searchQuery.toLowerCase()) && !app.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // --- Pagination ---
  const totalPages = Math.max(1, Math.ceil(filteredApps.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageApps = filteredApps.slice(pageStart, pageStart + pageSize);

  // --- Pencarian dibatasi ke halaman aktif ---
  // Search hanya mencari aplikasi yang tampil di halaman pagination saat ini.
  const searchTerm = searchQuery.trim().toLowerCase();
  const visibleApps = searchTerm
    ? pageApps.filter(app => app.name.toLowerCase().includes(searchTerm) || app.description.toLowerCase().includes(searchTerm))
    : pageApps;
  const isPageEmpty = filteredApps.length === 0;
  const noPageResults = !isPageEmpty && searchTerm && visibleApps.length === 0;

  // Jaga halaman aktif tetap valid saat data menyusut (mis. item terakhir dihapus).
  useEffect(() => {
    if (currentPage > totalPages && currentPage !== safePage) setCurrentPage(safePage); // eslint-disable-line react-hooks/set-state-in-effect
  }, [currentPage, totalPages, safePage]);

  // Daftar nomor halaman dengan elipsis di kiri/kanan saat halaman banyak.
  const pageItems = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const set = new Set([1, 2, safePage - 1, safePage, safePage + 1, totalPages - 1, totalPages]);
    const nums = Array.from(set).filter(p => p >= 1 && p <= totalPages).sort((a, b) => a - b);
    const items: (number | 'ellipsis')[] = [];
    for (let i = 0; i < nums.length; i++) {
      if (i > 0 && nums[i] - nums[i - 1] > 1) items.push('ellipsis');
      items.push(nums[i]);
    }
    return items;
  }, [totalPages, safePage]);

  const goToPage = (p: number) => {
    const clamped = Math.min(Math.max(1, p), totalPages);
    setCurrentPage(clamped);
  };

  return (
    <div className="space-y-5">
      {/* Baris atas: pencarian + kontrol tampilan + tambah */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <SearchAutocomplete
          items={pageApps.map((a) => a.name)}
          getLabel={(name) => name}
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Cari aplikasi di halaman ini… (nama atau deskripsi)"
          inputRef={searchRef}
          hint={
            <kbd className="hidden sm:inline-flex items-center rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
              ⌘K
            </kbd>
          }
          className="flex-1 min-w-[200px]"
        />
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 gap-0.5">
            <button
              onClick={() => setView('grid')}
              className={`p-1.5 rounded-md transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${currentView === 'grid' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
              aria-label="Tampilan grid"
              title="Tampilan grid"
            >
              <i className="fas fa-th-large"></i>
            </button>
            <button
              onClick={() => setView('list')}
              className={`p-1.5 rounded-md transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${currentView === 'list' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
              aria-label="Tampilan daftar"
              title="Tampilan daftar"
            >
              <i className="fas fa-list"></i>
            </button>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="h-10 bg-indigo-600 text-white px-4 rounded-lg hover:bg-indigo-700 inline-flex items-center gap-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-slate-900 transition-colors"
          >
            <i className="fas fa-plus text-xs"></i> <span className="hidden sm:inline">Tambah</span>
          </button>
        </div>
      </div>

      {/* Baris filter: dua grup terpisah — Kategori | Status & Lingkungan */}
      <div className="flex flex-col lg:flex-row lg:items-start gap-3 lg:gap-4">
        <div className="flex-1 min-w-0">
          <p className="mb-1.5 text-xs text-slate-400 dark:text-slate-500">Kategori</p>
          <div className="flex items-center gap-2">
            {/* "Semua" dipatok di kiri — tidak ikut scroll bersama daftar kategori */}
            <button
              onClick={() => setCategoryFilter('all')}
              className={`${chipBase} shrink-0 ${categoryFilter === 'all' ? chipActive : chipInactive}`}
              aria-pressed={categoryFilter === 'all'}
            >
              <span>Semua</span>
              <span className={`${chipCount} ${categoryFilter === 'all' ? 'text-white/70' : 'text-slate-400 dark:text-slate-500'}`}>{localApps.length}</span>
            </button>
            <div className={`flex items-center gap-2 overflow-x-auto pb-0.5 flex-1 min-w-0 ${hideScrollbar}`}>
              {categoryChips.filter(c => c.name !== 'all').map(cat => (
                <button
                  key={cat.name}
                  onClick={() => setCategoryFilter(cat.name)}
                  className={`${chipBase} shrink-0 ${categoryFilter === cat.name ? chipActive : chipInactive}`}
                  aria-pressed={categoryFilter === cat.name}
                >
                  <span className="max-w-[140px] truncate">{cat.label}</span>
                  <span className={`${chipCount} ${categoryFilter === cat.name ? 'text-white/70' : 'text-slate-400 dark:text-slate-500'}`}>{cat.count}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Pembatas: tanda bahwa grup filter kategori terpisah dari status */}
        <div aria-hidden="true" className="hidden lg:block self-stretch w-px bg-slate-200 dark:bg-slate-700/60"></div>

        <div className="shrink-0">
          <p className="mb-1.5 text-xs text-slate-400 dark:text-slate-500">Status &amp; Lingkungan</p>
          <div className="flex items-center gap-2">
            <div className={`inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 gap-0.5 overflow-x-auto max-w-full ${hideScrollbar}`}>
              {STATUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setStatusFilter(opt.value)}
                  className={`px-2.5 py-1.5 text-xs whitespace-nowrap rounded-md transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${statusFilter === opt.value ? 'bg-indigo-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                  aria-pressed={statusFilter === opt.value}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="relative">
              <select
                value={envFilter}
                onChange={(e) => setEnvFilter(e.target.value)}
                className="h-9 appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-3 pr-8 text-xs text-slate-700 dark:text-slate-200 outline-none transition-shadow focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 cursor-pointer"
                aria-label="Filter lingkungan"
              >
                {ENV_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <i className="fas fa-chevron-down absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none"></i>
            </div>
          </div>
        </div>
      </div>

      {isPageEmpty ? (
        <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 py-14 px-6 text-center">
          <div className="mx-auto w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
            <i className="fas fa-search text-sm"></i>
          </div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Tidak ada aplikasi yang cocok</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            {hasFilters ? 'Coba ubah kata kunci atau hapus filter.' : 'Belum ada aplikasi terdaftar.'}
          </p>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="mt-4 inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <i className="fas fa-rotate-left"></i> Hapus filter
            </button>
          )}
        </div>
      ) : noPageResults ? (
        <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 py-14 px-6 text-center">
          <div className="mx-auto w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
            <i className="fas fa-magnifying-glass text-sm"></i>
          </div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Tidak ada hasil di halaman {safePage}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-md mx-auto">
            Pencarian dibatasi ke halaman yang sedang dibuka — coba halaman lain atau hapus kata kunci.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 flex-wrap justify-center">
            <button
              onClick={() => setSearchQuery('')}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <i className="fas fa-rotate-left"></i> Hapus pencarian
            </button>
            {safePage > 1 && (
              <button
                onClick={() => goToPage(safePage - 1)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <i className="fas fa-chevron-left"></i> Cari di halaman sebelumnya
              </button>
            )}
            {safePage < totalPages && (
              <button
                onClick={() => goToPage(safePage + 1)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                Cari di halaman berikutnya <i className="fas fa-arrow-right"></i>
              </button>
            )}
          </div>
        </div>
      ) : currentView === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visibleApps.map(app => (
            <article
              key={app.id}
              onClick={() => setSelectedApp(app)}
              className="group relative bg-white dark:bg-slate-800 rounded-xl border border-slate-200/70 dark:border-slate-700/60 overflow-hidden cursor-pointer transition-all duration-200 hover:border-indigo-300 dark:hover:border-indigo-700/60 hover:shadow-md hover:shadow-slate-200/60 dark:hover:shadow-black/20 motion-reduce:transition-none flex flex-col"
            >
              {/* Isi latar progres: makin tinggi, makin penuh warna mengisi kartu */}
              <div aria-hidden="true" className={`absolute inset-x-0 bottom-0 pointer-events-none transition-[height] duration-500 motion-reduce:transition-none ${statusStyle(app.status).fill}`} style={{ height: `${app.progress}%` }}></div>
              <div className="absolute inset-x-0 top-0 h-0.5 bg-slate-100 dark:bg-slate-700/50">
                <div className={`h-full ${statusStyle(app.status).rule}`} style={{ width: `${app.progress}%` }}></div>
              </div>
              <div className="relative p-5 pt-6 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 shrink-0 rounded-lg bg-slate-100 dark:bg-slate-700/50 border border-slate-200/60 dark:border-slate-600/50 flex items-center justify-center text-slate-500 dark:text-slate-300 text-sm font-semibold transition-colors group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                      {getInitials(app.name)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">{app.name}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{app.category}</p>
                    </div>
                  </div>
                  <span className="flex items-center gap-1.5 shrink-0 text-xs text-slate-500 dark:text-slate-400">
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[app.status] ?? 'bg-slate-400'}`}></span>
                    {STATUS_LABEL[app.status] ?? app.status}
                  </span>
                </div>
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">{app.description}</p>
                {app.tech.length > 0 && (
                  <p className="mt-4 text-xs text-slate-400 dark:text-slate-500 truncate" title={app.tech.join(' · ')}>
                    {app.tech.join(' · ')}
                  </p>
                )}
              </div>
              <div className="relative px-5 py-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs">
                <span className="text-slate-400 dark:text-slate-500 capitalize truncate">{app.env} · v{app.version}</span>
                <span className={`font-semibold tabular-nums shrink-0 ${statusStyle(app.status).text}`}>{app.progress}%</span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {visibleApps.map(app => (
            <div
              key={app.id}
              onClick={() => setSelectedApp(app)}
              className="group flex items-center gap-4 bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700/60 rounded-lg px-4 py-3 cursor-pointer transition-all duration-200 hover:border-indigo-300 dark:hover:border-indigo-700/60 motion-reduce:transition-none"
            >
              <div className="w-9 h-9 shrink-0 rounded-lg bg-slate-100 dark:bg-slate-700/50 border border-slate-200/60 dark:border-slate-600/50 flex items-center justify-center text-slate-500 dark:text-slate-300 text-xs font-semibold transition-colors group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                {getInitials(app.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{app.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{app.category}</p>
              </div>
              {app.tech.length > 0 && (
                <p className="hidden md:block text-xs text-slate-400 dark:text-slate-500 truncate max-w-[220px]">{app.tech.join(' · ')}</p>
              )}
              <span className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 shrink-0">
                <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[app.status] ?? 'bg-slate-400'}`}></span>
                {STATUS_LABEL[app.status] ?? app.status}
              </span>
              <span className="hidden lg:block text-xs text-slate-400 dark:text-slate-500 capitalize shrink-0 w-20 text-right">{app.env}</span>
              <div className="flex items-center gap-2 shrink-0 w-24">
                <div className="flex-1 h-1 rounded-full bg-slate-100 dark:bg-slate-700/50 overflow-hidden">
                  <div className={`h-full ${statusStyle(app.status).rule}`} style={{ width: `${app.progress}%` }}></div>
                </div>
                <span className={`text-xs font-medium tabular-nums w-9 text-right ${statusStyle(app.status).text}`}>{app.progress}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Pagination */}
      {filteredApps.length > 0 && (
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1">
          <p role="status" className="text-xs text-slate-400 dark:text-slate-500 tabular-nums order-2 lg:order-1">
            {searchTerm ? (
              <>Menampilkan <span className="font-medium text-slate-600 dark:text-slate-300">{visibleApps.length}</span> hasil di halaman {safePage} <span className="text-slate-400">(dari {pageApps.length} aplikasi halaman)</span></>
            ) : (
              <>Menampilkan <span className="font-medium text-slate-600 dark:text-slate-300">{pageStart + 1}</span>–<span className="font-medium text-slate-600 dark:text-slate-300">{pageStart + pageApps.length}</span> dari <span className="font-medium text-slate-600 dark:text-slate-300">{filteredApps.length}</span> aplikasi</>
            )}
          </p>

          <div className="flex items-center justify-between lg:justify-end gap-2 flex-wrap order-1 lg:order-2">
            {/* Navigasi halaman */}
            <nav aria-label="Navigasi halaman" className="flex items-center gap-1">
              <button
                onClick={() => goToPage(safePage - 1)}
                disabled={safePage <= 1}
                className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-40 disabled:pointer-events-none transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                aria-label="Halaman sebelumnya"
              >
                <i className="fas fa-chevron-left text-[10px]"></i>
              </button>
              {pageItems.map((item, i) =>
                item === 'ellipsis' ? (
                  <span key={`e-${i}`} aria-hidden="true" className="px-1 text-slate-400 dark:text-slate-500 text-xs select-none">…</span>
                ) : (
                  <button
                    key={item}
                    onClick={() => goToPage(item)}
                    aria-current={item === safePage ? 'page' : undefined}
                    className={`h-8 min-w-8 px-2 flex items-center justify-center rounded-lg text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${item === safePage ? 'bg-indigo-600 text-white' : 'border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600 dark:hover:text-indigo-400'}`}
                    aria-label={`Halaman ${item}`}
                  >
                    {item}
                  </button>
                )
              )}
              <button
                onClick={() => goToPage(safePage + 1)}
                disabled={safePage >= totalPages}
                className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-40 disabled:pointer-events-none transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                aria-label="Halaman berikutnya"
              >
                <i className="fas fa-chevron-right text-[10px]"></i>
              </button>
            </nav>

            {/* Lompat ke halaman tertentu */}
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="text-xs text-slate-400 dark:text-slate-500">Ke</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                defaultValue={safePage}
                key={safePage}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const v = Number((e.target as HTMLInputElement).value);
                    if (v) goToPage(Math.round(v));
                  }
                }}
                onBlur={(e) => {
                  const v = Number(e.target.value);
                  if (v && v !== safePage) goToPage(Math.round(v));
                }}
                className="w-12 h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-center text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 tabular-nums"
                aria-label="Lompat ke halaman"
              />
            </div>

            {/* Ukuran halaman */}
            <div className="relative">
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="h-8 appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-2.5 pr-7 text-xs text-slate-600 dark:text-slate-300 outline-none transition-shadow focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 cursor-pointer"
                aria-label="Jumlah aplikasi per halaman"
              >
                {[6, 9, 12, 18, 24].map(n => (
                  <option key={n} value={n}>{n} / hal.</option>
                ))}
              </select>
              <i className="fas fa-chevron-down absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none"></i>
            </div>
          </div>
        </div>
      )}
      <DetailDrawer app={selectedApp} onClose={() => setSelectedApp(null)} onDelete={handleDeleteApp} onEdit={(app) => { setSelectedApp(null); setEditingApp(app); setShowAddModal(true); }} />
      {showAddModal && <AddAppModal onClose={() => { setShowAddModal(false); setEditingApp(null); }} onAdd={handleSaveApp} nextId={localApps.reduce((m, a) => (a.id > m ? a.id : m), 0) + 1} initialApp={editingApp} categories={localCategories} technologies={mergedTechnologies} />}
    </div>
  );
}
