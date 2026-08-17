"use client";

import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { App } from '@/types';
import { useRealtime } from '@/hooks/useRealtime';
import { addCustomTechnology, getCustomTechnologies, removeCustomTechnology, renameCustomTechnology, saveCustomTechnologies } from '@/lib/customTech';
import SearchAutocomplete from './SearchAutocomplete';

interface TechnologiesPageProps {
  apps: App[];
  technologies: string[];
}

const availableGradients = ['from-sky-400 to-blue-500', 'from-violet-400 to-purple-500', 'from-emerald-400 to-teal-500', 'from-amber-400 to-orange-500', 'from-rose-400 to-pink-500', 'from-indigo-400 to-violet-500', 'from-cyan-400 to-sky-500', 'from-lime-400 to-green-500'];

export default function TechnologiesPage({ apps, technologies }: TechnologiesPageProps) {
  const router = useRouter();
  const [selectedTech, setSelectedTech] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => { setSelectedTech(null); setIsClosing(false); }, 300);
  };
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTech, setEditingTech] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [localApps, setLocalApps] = useState<App[]>(apps);
  const [localTech, setLocalTech] = useState<string[]>(technologies);
  // Teknologi tambahan dari browser (belum dipakai aplikasi apa pun).
  const [customTech, setCustomTech] = useState<string[]>([]);
  const [formData, setFormData] = useState({ name: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  // Ambil ulang data (apps + teknologi) dari database.
  const refreshAll = useCallback(async () => {
    try {
      const [appsRes, techRes] = await Promise.all([fetch('/api/apps'), fetch('/api/technologies')]);
      if (appsRes.ok) {
        const data = await appsRes.json();
        if (Array.isArray(data.apps)) setLocalApps(data.apps);
      }
      if (techRes.ok) {
        const data = await techRes.json();
        if (Array.isArray(data.technologies)) setLocalTech(data.technologies);
      }
    } catch (e) {
      console.error('Gagal menyegarkan data teknologi:', e);
    }
  }, []);

  // Perubahan database (dari tab/admin lain) tampil otomatis.
  useRealtime(refreshAll);

  // Kembali ke halaman 1 saat pencarian/ukuran halaman berubah.
  useEffect(() => {
    setCurrentPage(1); // eslint-disable-line react-hooks/set-state-in-effect
  }, [searchQuery, pageSize]);

  // Sinkronkan dengan database saat halaman pertama dimuat.
  useEffect(() => {
    const t = window.setTimeout(() => refreshAll(), 0);
    return () => window.clearTimeout(t);
  }, [refreshAll]);

  // Muat teknologi tambahan dari browser.
  useEffect(() => {
    setCustomTech(getCustomTechnologies()); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  // Teknologi lokal yang sudah dipakai aplikasi otomatis menjadi bagian daftar
  // database — bersihkan dari daftar lokal agar tidak dobel.
  useEffect(() => {
    const server = new Set(localTech);
    const next = customTech.filter((t) => !server.has(t));
    if (next.length !== customTech.length) {
      setCustomTech(next); // eslint-disable-line react-hooks/set-state-in-effect
      saveCustomTechnologies(next);
    }
  }, [localTech, customTech]);

  // Jumlah aplikasi per teknologi.
  const techUsage = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of localApps) {
      for (const t of a.tech) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return counts;
  }, [localApps]);

  const getGradient = (name: string) =>
    availableGradients[name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % availableGradients.length];

  // Teknologi yang hanya ada di daftar lokal browser (belum dipakai app).
  const isCustomOnly = (name: string) => customTech.includes(name) && !localTech.includes(name);

  const sortedTech = useMemo(() => {
    const set = new Set<string>([...localTech, ...customTech]);
    for (const t of techUsage.keys()) set.add(t); // pastikan tech dari app ikut tampil
    return Array.from(set).sort((a, b) => (techUsage.get(b) ?? 0) - (techUsage.get(a) ?? 0) || a.localeCompare(b));
  }, [localTech, customTech, techUsage]);

  const appsWithTech = selectedTech ? localApps.filter(a => a.tech.includes(selectedTech)) : [];

  // --- Pencarian + pagination ---
  const searchTerm = searchQuery.trim().toLowerCase();
  const filteredTech = searchTerm
    ? sortedTech.filter(t => t.toLowerCase().includes(searchTerm))
    : sortedTech;

  const totalPages = Math.max(1, Math.ceil(filteredTech.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageTech = filteredTech.slice(pageStart, pageStart + pageSize);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = formData.name.trim();
    if (!name || saving) return;
    // Cegah duplikat (kecuali nama yang sedang diedit itu sendiri).
    const all = new Set([...localTech, ...customTech]);
    if (all.has(name) && name !== editingTech) {
      setFormError('Nama teknologi sudah ada');
      return;
    }
    setSaving(true);
    setFormError(null);

    // Mode TAMBAH: simpan ke daftar lokal browser (belum dipakai app →
    // belum ada baris di app_tech). Muncul otomatis di pilihan form aplikasi.
    if (!editingTech) {
      const next = addCustomTechnology(name);
      setCustomTech(next);
      setSaving(false);
      setShowAddModal(false);
      setFormData({ name: '' });
      refreshAll();
      return;
    }

    // Edit teknologi LOKAL: cukup ganti nama di daftar browser.
    if (isCustomOnly(editingTech)) {
      const next = renameCustomTechnology(editingTech, name);
      setCustomTech(next);
      setSaving(false);
      setShowAddModal(false);
      setEditingTech(null);
      setFormData({ name: '' });
      refreshAll();
      return;
    }

    // Edit teknologi DATABASE: rename semua relasi app_tech via API.
    try {
      const res = await fetch(`/api/technologies/${encodeURIComponent(editingTech)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaving(false);
        setFormError(data?.error || 'Gagal memperbarui teknologi');
        return;
      }
      setSaving(false);
      setShowAddModal(false);
      setEditingTech(null);
      setFormData({ name: '' });
      refreshAll();
    } catch (e) {
      console.error('Gagal menyimpan teknologi:', e);
      setSaving(false);
      setFormError('Terjadi kesalahan saat menyimpan teknologi');
    }
  };

  const handleEdit = (tech: string) => {
    setFormData({ name: tech });
    setEditingTech(tech);
    setFormError(null);
    setShowAddModal(true);
  };

  const handleDelete = async (tech: string) => {
    setDeleting(tech);
    setDeleteError(null);

    // Teknologi lokal (belum dipakai app): cukup hapus dari daftar browser.
    if (isCustomOnly(tech)) {
      const next = removeCustomTechnology(tech);
      setCustomTech(next);
      setDeleting(null);
      setShowDeleteConfirm(null);
      return;
    }

    try {
      const res = await fetch(`/api/technologies/${encodeURIComponent(tech)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteError(data?.error || 'Gagal menghapus teknologi');
        setDeleting(null);
        return;
      }
    } catch (e) {
      console.error('Gagal menghapus teknologi:', e);
      setDeleteError('Terjadi kesalahan saat menghapus teknologi');
      setDeleting(null);
      return;
    }
    setDeleting(null);
    setShowDeleteConfirm(null);
    refreshAll();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <SearchAutocomplete
            items={sortedTech}
            getLabel={(name) => name}
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Cari nama teknologi..."
            className="flex-1 sm:flex-none sm:w-64 min-w-[180px]"
          />
          <button onClick={() => { setEditingTech(null); setFormData({ name: '' }); setFormError(null); setShowAddModal(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded-full hover:bg-indigo-700 flex items-center gap-2 text-sm font-medium shrink-0">
            <i className="fas fa-plus"></i> <span className="hidden sm:inline">Tambah Teknologi</span>
          </button>
        </div>
      </div>

      {filteredTech.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 py-14 px-6 text-center">
          <div className="mx-auto w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
            <i className="fas fa-magnifying-glass text-sm"></i>
          </div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Tidak ada teknologi yang cocok</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            {searchQuery.trim() ? 'Coba kata kunci lain atau hapus pencarian.' : 'Klik Tambah Teknologi untuk menambahkan teknologi baru.'}
          </p>
          <button
            onClick={() => setSearchQuery('')}
            className="mt-4 inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <i className="fas fa-rotate-left"></i> Hapus pencarian
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {pageTech.map(tech => {
            const count = techUsage.get(tech) ?? 0;
            const gradient = getGradient(tech);
            return (
              <div key={tech} onClick={() => setSelectedTech(tech)} className="group relative bg-white/80 dark:bg-slate-800/60 backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-slate-700/50 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden cursor-pointer">
                <div className={`absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-[0.07] transition-opacity ${gradient} pointer-events-none`} />
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white shadow-lg`}>
                      <i className="fas fa-microchip text-lg"></i>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={(e) => { e.stopPropagation(); handleEdit(tech); }} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"><i className="fas fa-pen text-xs"></i></button>
                      <button onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(tech); }} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"><i className="fas fa-trash text-xs"></i></button>
                    </div>
                  </div>
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{tech}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                    {count} aplikasi
                    {isCustomOnly(tech) && (
                      <span className="px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-medium">belum dipakai</span>
                    )}
                  </p>
                  <div className="mt-3 space-y-1.5">
                    {localApps.filter(a => a.tech.includes(tech)).slice(0, 3).map(app => (
                      <div key={app.id} className="flex items-center gap-2 text-xs">
                        <div className={`w-6 h-6 rounded-md bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0`}>{app.name.substring(0, 2).toUpperCase()}</div>
                        <span className="text-slate-600 dark:text-slate-300 truncate">{app.name}</span>
                      </div>
                    ))}
                  </div>
                  {count > 3 && <p className="text-xs text-slate-400 mt-2">+{count - 3} lainnya</p>}
                  <div className="mt-3 flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400">
                    Klik untuk lihat detail <i className="fas fa-arrow-right text-[10px]"></i>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {filteredTech.length > 0 && (
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1">
          <p role="status" className="text-xs text-slate-400 dark:text-slate-500 tabular-nums order-2 lg:order-1">
            Menampilkan <span className="font-medium text-slate-600 dark:text-slate-300">{pageStart + 1}</span>–<span className="font-medium text-slate-600 dark:text-slate-300">{pageStart + pageTech.length}</span> dari <span className="font-medium text-slate-600 dark:text-slate-300">{filteredTech.length}</span> teknologi
          </p>

          <div className="flex items-center justify-between lg:justify-end gap-2 flex-wrap order-1 lg:order-2">
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

            <div className="relative">
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="h-8 appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-2.5 pr-7 text-xs text-slate-600 dark:text-slate-300 outline-none transition-shadow focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 cursor-pointer"
                aria-label="Jumlah teknologi per halaman"
              >
                {[8, 12, 16, 24].map(n => (
                  <option key={n} value={n}>{n} / hal.</option>
                ))}
              </select>
              <i className="fas fa-chevron-down absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none"></i>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={() => { setShowAddModal(false); setEditingTech(null); }}>
          <div className="bg-white/90 dark:bg-slate-900 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/60 dark:border-slate-700/50 w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200/60 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/50">
              <button onClick={() => { setShowAddModal(false); setEditingTech(null); }} className="w-3 h-3 rounded-full bg-red-400 hover:bg-red-500 transition-colors" />
              <span className="w-3 h-3 rounded-full bg-amber-400" />
              <span className="w-3 h-3 rounded-full bg-emerald-400" />
              <p className="ml-2 text-sm font-medium text-slate-600 dark:text-slate-300">{editingTech ? 'Edit Teknologi' : 'Tambah Teknologi'}</p>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 block">Nama Teknologi</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="cth. Next.js" className="w-full bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent" autoFocus />
                {!editingTech && (
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">Disimpan di browser ini — langsung muncul di pilihan form aplikasi, dan tersimpan permanen di database begitu dipakai oleh sebuah aplikasi.</p>
                )}
              </div>
              {formError && (
                <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                  <i className="fas fa-circle-exclamation mt-0.5"></i>
                  <span>{formError}</span>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => { setShowAddModal(false); setEditingTech(null); }} className="px-4 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-60" disabled={saving}>Batal</button>
                <button type="submit" disabled={saving} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2">
                  {saving && <i className="fas fa-spinner fa-spin text-xs"></i>}
                  {saving ? 'Menyimpan...' : editingTech ? 'Simpan' : 'Tambah'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(null)}>
          <div className="bg-white/90 dark:bg-slate-900 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/60 dark:border-slate-700/50 w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4"><i className="fas fa-trash text-red-500"></i></div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">Hapus Teknologi?</h3>
              {showDeleteConfirm && isCustomOnly(showDeleteConfirm) ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Teknologi &quot;{showDeleteConfirm}&quot; belum dipakai aplikasi mana pun dan hanya ada di daftar browser ini. Hapus dari daftar?</p>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Teknologi &quot;{showDeleteConfirm}&quot; akan dihapus permanen, termasuk dari {techUsage.get(showDeleteConfirm ?? '') ?? 0} aplikasi yang memakainya.</p>
              )}
              {deleteError && (
                <p role="alert" className="text-sm text-red-500 dark:text-red-400 mt-2">{deleteError}</p>
              )}
              <div className="flex gap-2 mt-5">
                <button onClick={() => { setShowDeleteConfirm(null); setDeleteError(null); }} className="flex-1 px-4 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-60" disabled={deleting !== null}>Batal</button>
                <button onClick={() => handleDelete(showDeleteConfirm)} disabled={deleting !== null} className="flex-1 px-4 py-2 rounded-lg text-sm bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2">
                  {deleting === showDeleteConfirm && <i className="fas fa-spinner fa-spin text-xs"></i>}
                  {deleting === showDeleteConfirm ? 'Menghapus...' : 'Hapus'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedTech && (
        <div className={`fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm transition-opacity duration-300 ${isClosing ? 'opacity-0' : 'opacity-100'}`} onClick={handleClose}>
          <div className={`relative w-full max-w-md h-full bg-white dark:bg-slate-800 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${isClosing ? 'translate-x-full' : 'translate-x-0'}`} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 shrink-0 rounded-lg bg-gradient-to-br ${getGradient(selectedTech)} flex items-center justify-center text-white`}>
                  <i className="fas fa-microchip text-sm"></i>
                </div>
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 truncate">{selectedTech}</h2>
              </div>
              <button onClick={handleClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"><i className="fas fa-times"></i></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-2">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{appsWithTech.length} aplikasi memakai teknologi ini</p>
              {selectedTech && isCustomOnly(selectedTech) && (
                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <i className="fas fa-circle-info"></i> Teknologi ini hanya ada di daftar browser — belum dipakai aplikasi mana pun. Otomatis masuk database begitu dipakai.
                </p>
              )}
              {appsWithTech.map(app => (
                <div key={app.id} onClick={() => router.push(`/apps?app=${app.id}`)} className="group/app flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/30 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors cursor-pointer">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold bg-gradient-to-br ${getGradient(selectedTech)}`}>{app.name.substring(0, 2).toUpperCase()}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{app.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{app.description}</p>
                  </div>
                  <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${app.status === 'active' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>{app.status}</span>
                  <i className="fas fa-arrow-right text-xs text-slate-300 dark:text-slate-600 group-hover/app:text-indigo-500 transition-colors"></i>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
