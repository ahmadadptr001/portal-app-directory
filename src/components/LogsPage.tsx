"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ActivityAction, ActivityEntity, ActivityLog } from '@/lib/apps';
import { useRealtime } from '@/hooks/useRealtime';
import SearchAutocomplete from './SearchAutocomplete';

interface LogsPageProps {
  logs: ActivityLog[];
  total: number;
}

const ACTION_META: Record<ActivityAction, { icon: string; label: string; chip: string }> = {
  create: { icon: 'fa-plus', label: 'Menambahkan', chip: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' },
  update: { icon: 'fa-pen', label: 'Mengubah', chip: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' },
  delete: { icon: 'fa-trash', label: 'Menghapus', chip: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400' },
  import: { icon: 'fa-file-import', label: 'Mengimpor', chip: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400' },
  reset: { icon: 'fa-triangle-exclamation', label: 'Meriset', chip: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' },
};

const ENTITY_LABEL: Record<ActivityEntity, string> = {
  app: 'aplikasi',
  category: 'kategori',
  technology: 'teknologi',
  system: 'sistem',
  changelog: 'riwayat versi',
};

function describe(log: ActivityLog): string {
  const meta = ACTION_META[log.action] ?? ACTION_META.update;
  if (log.entityType === 'system') return `${meta.label} ${log.entityName}`;
  return `${meta.label} ${ENTITY_LABEL[log.entityType] ?? 'entitas'} "${log.entityName}"`;
}

function timeAgo(iso: string, now: number): string {
  const diff = now - new Date(iso).getTime();
  if (Number.isNaN(diff) || diff < 0) return 'baru saja';
  if (diff < 60 * 1000) return 'baru saja';
  const mins = Math.floor(diff / (60 * 1000));
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(diff / (60 * 60 * 1000));
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.floor(hours / 24)} hari lalu`;
}

function fullTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function LogsPage({ logs: initialLogs, total: initialTotal }: LogsPageProps) {
  const router = useRouter();
  const [logs, setLogs] = useState<ActivityLog[]>(initialLogs);
  const [total, setTotal] = useState(initialTotal);
  const [actionFilter, setActionFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [now, setNow] = useState(() => Date.now());

  // Muat log sesuai filter + halaman aktif (dipakai realtime & polling juga).
  const load = useCallback(async () => {
    const qs = new URLSearchParams();
    if (actionFilter !== 'all') qs.set('action', actionFilter);
    if (typeFilter !== 'all') qs.set('entityType', typeFilter);
    const search = searchQuery.trim();
    if (search) qs.set('search', search);
    qs.set('limit', String(pageSize));
    qs.set('offset', String((currentPage - 1) * pageSize));
    try {
      const res = await fetch(`/api/logs?${qs.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.logs)) {
        setLogs(data.logs);
        if (typeof data.total === 'number') setTotal(data.total);
        setNow(Date.now());
      }
    } catch (e) {
      console.error('Gagal menyegarkan log aktivitas:', e);
    }
  }, [actionFilter, typeFilter, searchQuery, currentPage, pageSize]);

  // Perubahan database (dari tab/admin lain) tampil otomatis.
  useRealtime(load);

  // Kembali ke halaman 1 saat filter/ukuran halaman berubah.
  useEffect(() => {
    setCurrentPage(1); // eslint-disable-line react-hooks/set-state-in-effect
  }, [searchQuery, actionFilter, typeFilter, pageSize]);

  // Muat ulang saat filter/halaman berubah. `load` async — semua setState
  // terjadi SETELAH await fetch, tapi aturan lint tidak bisa melihat itu;
  // pengecualian eksplisit (pola yang sama dengan baris 98 & SystemPage).
  useEffect(() => {
    load(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  // Jaga halaman aktif tetap valid saat data menyusut.
  useEffect(() => {
    if (currentPage > totalPages && currentPage !== safePage) setCurrentPage(safePage); // eslint-disable-line react-hooks/set-state-in-effect
  }, [currentPage, totalPages, safePage]);

  // Daftar nomor halaman dengan elipsis saat halaman banyak.
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

  const hasFilters = actionFilter !== 'all' || typeFilter !== 'all' || searchQuery.trim() !== '';

  return (
    <div className="space-y-5">
      {/* Toolbar: pencarian + filter aksi + filter entitas */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchAutocomplete
          items={logs.map((l) => l.entityName)}
          getLabel={(name) => name}
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Cari nama aplikasi, kategori, atau teknologi..."
          className="flex-1 min-w-[200px]"
        />
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="h-10 appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-3 pr-8 text-sm text-slate-700 dark:text-slate-200 outline-none transition-shadow focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 cursor-pointer"
              aria-label="Filter aksi"
            >
              <option value="all">Semua aksi</option>
              <option value="create">Menambahkan</option>
              <option value="update">Mengubah</option>
              <option value="delete">Menghapus</option>
              <option value="import">Mengimpor</option>
              <option value="reset">Meriset</option>
            </select>
            <i className="fas fa-chevron-down absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none"></i>
          </div>
          <div className="relative">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-10 appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-3 pr-8 text-sm text-slate-700 dark:text-slate-200 outline-none transition-shadow focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 cursor-pointer"
              aria-label="Filter jenis entitas"
            >
              <option value="all">Semua entitas</option>
              <option value="app">Aplikasi</option>
              <option value="category">Kategori</option>
              <option value="technology">Teknologi</option>
              <option value="system">Sistem</option>
              <option value="changelog">Riwayat Versi</option>
            </select>
            <i className="fas fa-chevron-down absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none"></i>
          </div>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 py-14 px-6 text-center">
          <div className="mx-auto w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
            <i className="fas fa-clock-rotate-left text-sm"></i>
          </div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {hasFilters ? 'Tidak ada log yang cocok' : 'Belum ada aktivitas tercatat'}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            {hasFilters ? 'Coba ubah kata kunci atau filter.' : 'Aktivitas akan tercatat otomatis saat data diubah.'}
          </p>
          {hasFilters && (
            <button
              onClick={() => { setSearchQuery(''); setActionFilter('all'); setTypeFilter('all'); }}
              className="mt-4 inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-700 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <i className="fas fa-rotate-left"></i> Hapus filter
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/70 dark:border-slate-700/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="text-left text-xs text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Aktivitas</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Admin</th>
                  <th scope="col" className="px-4 py-2.5 font-medium text-right">Waktu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {logs.map(log => {
                  const meta = ACTION_META[log.action] ?? ACTION_META.update;
                  const sentence = describe(log);
                  return (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-3">
                          <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs shrink-0 ${meta.chip}`}>
                            <i className={`fas ${meta.icon}`}></i>
                          </span>
                          <div className="min-w-0">
                            {log.entityType === 'app' && log.entityId != null ? (
                              <button
                                onClick={() => router.push(`/apps?app=${log.entityId}`)}
                                className="text-sm text-slate-700 dark:text-slate-200 text-left hover:text-blue-600 dark:hover:text-blue-400 underline-offset-2 hover:underline transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                              >
                                {sentence}
                              </button>
                            ) : (
                              <p className="text-sm text-slate-700 dark:text-slate-200">{sentence}</p>
                            )}
                            {log.details && (
                              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{log.details}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          <i className="fas fa-user text-[10px] text-slate-300 dark:text-slate-600"></i>
                          {log.adminUsername}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {/* suppressHydrationWarning: teks ini bergantung pada `now`
                            (waktu render server vs hidrasi berbeda beberapa ms),
                            sehingga bisa mismatch di batas menit/jam. Nilai akan
                            diperbarui setelah mount lewat fetch /api/logs. */}
                        <span suppressHydrationWarning className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap" title={fullTime(log.createdAt)}>
                          {timeAgo(log.createdAt, now)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {logs.length > 0 && (
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1">
          <p role="status" className="text-xs text-slate-400 dark:text-slate-500 tabular-nums order-2 lg:order-1">
            Menampilkan <span className="font-medium text-slate-600 dark:text-slate-300">{Math.min((safePage - 1) * pageSize + 1, total)}</span>–<span className="font-medium text-slate-600 dark:text-slate-300">{Math.min(safePage * pageSize, total)}</span> dari <span className="font-medium text-slate-600 dark:text-slate-300">{total}</span> catatan
          </p>

          <div className="flex items-center justify-between lg:justify-end gap-2 flex-wrap order-1 lg:order-2">
            <nav aria-label="Navigasi halaman" className="flex items-center gap-1">
              <button
                onClick={() => goToPage(safePage - 1)}
                disabled={safePage <= 1}
                className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-blue-300 dark:hover:border-blue-700 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-40 disabled:pointer-events-none transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
                    className={`h-8 min-w-8 px-2 flex items-center justify-center rounded-lg text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${item === safePage ? 'bg-blue-600 text-white' : 'border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-blue-300 dark:hover:border-blue-700 hover:text-blue-600 dark:hover:text-blue-400'}`}
                    aria-label={`Halaman ${item}`}
                  >
                    {item}
                  </button>
                )
              )}
              <button
                onClick={() => goToPage(safePage + 1)}
                disabled={safePage >= totalPages}
                className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-blue-300 dark:hover:border-blue-700 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-40 disabled:pointer-events-none transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                aria-label="Halaman berikutnya"
              >
                <i className="fas fa-chevron-right text-[10px]"></i>
              </button>
            </nav>

            <div className="relative">
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="h-8 appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-2.5 pr-7 text-xs text-slate-600 dark:text-slate-300 outline-none transition-shadow focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 cursor-pointer"
                aria-label="Jumlah log per halaman"
              >
                {[15, 25, 50].map(n => (
                  <option key={n} value={n}>{n} / hal.</option>
                ))}
              </select>
              <i className="fas fa-chevron-down absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none"></i>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
