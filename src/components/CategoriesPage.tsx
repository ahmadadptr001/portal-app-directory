"use client";

import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { App } from '@/types';
import { useRealtime } from '@/hooks/useRealtime';
import { useRole } from '@/hooks/useRole';
import SearchAutocomplete from './SearchAutocomplete';

interface CategoriesPageProps {
  apps: App[];
}

interface CategoryConfig {
  name: string;
  icon: string;
  gradient: string;
}

const defaultIcons: Record<string, string> = {
  'Web App': 'fas fa-globe',
  'Mobile': 'fas fa-mobile-screen',
  'API': 'fas fa-code-branch',
  'Desktop': 'fas fa-desktop',
  'DevOps': 'fas fa-server',
  'AI/ML': 'fas fa-brain',
};

const defaultGradients: Record<string, string> = {
  'Web App': 'from-sky-400 to-blue-500',
  'Mobile': 'from-blue-400 to-purple-500',
  'API': 'from-emerald-400 to-teal-500',
  'Desktop': 'from-amber-400 to-orange-500',
  'DevOps': 'from-rose-400 to-pink-500',
  'AI/ML': 'from-blue-400 to-blue-400',
};

const availableIcons = ['fas fa-globe', 'fas fa-mobile-screen', 'fas fa-code-branch', 'fas fa-desktop', 'fas fa-server', 'fas fa-brain', 'fas fa-tag', 'fas fa-cloud', 'fas fa-database', 'fas fa-shield-halved', 'fas fa-paintbrush', 'fas fa-cart-shopping'];
const availableGradients = ['from-sky-400 to-blue-500', 'from-blue-400 to-purple-500', 'from-emerald-400 to-teal-500', 'from-amber-400 to-orange-500', 'from-rose-400 to-pink-500', 'from-blue-400 to-blue-400', 'from-cyan-400 to-sky-500', 'from-lime-400 to-green-500'];

export default function CategoriesPage({ apps }: CategoriesPageProps) {
  const router = useRouter();
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => { setSelectedCat(null); setIsClosing(false); }, 300);
  };
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);

  // Peran sesi — hanya untuk menyembunyikan tombol yang pasti ditolak server.
  const role = useRole();
  const canManage = role !== 'viewer';
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [customCategories, setCustomCategories] = useState<CategoryConfig[]>([]);
  const [localApps, setLocalApps] = useState<App[]>(apps);
  const [formData, setFormData] = useState({ name: '', icon: 'fas fa-tag', gradient: availableGradients[0] });
  const [categories, setCategories] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  useEffect(() => {
    try {
      const savedCats = localStorage.getItem('custom_categories');
      if (savedCats) setCustomCategories(JSON.parse(savedCats)); // eslint-disable-line react-hooks/set-state-in-effect
    } catch {}
    // Catatan: aplikasi sekarang berasal dari database (props), bukan localStorage.
  }, []);

  // Ambil ulang data (apps + kategori) dari database.
  const refreshAll = useCallback(async () => {
    try {
      const [appsRes, catsRes] = await Promise.all([fetch('/api/apps'), fetch('/api/categories')]);
      if (appsRes.ok) {
        const data = await appsRes.json();
        if (Array.isArray(data.apps)) setLocalApps(data.apps);
      }
      if (catsRes.ok) {
        const data = await catsRes.json();
        if (Array.isArray(data.categories)) setCategories(data.categories);
      }
    } catch (e) {
      console.error('Gagal menyegarkan data kategori:', e);
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

  const categoryMap: Record<string, number> = {};
  localApps.forEach(a => { categoryMap[a.category] = (categoryMap[a.category] || 0) + 1; });
  categories.forEach(c => { if (!categoryMap[c]) categoryMap[c] = 0; });
  Object.values(customCategories).forEach(c => { if (!categoryMap[c.name]) categoryMap[c.name] = 0; });

  const getCategoryIcon = (cat: string) => {
    const custom = customCategories.find(c => c.name === cat);
    if (custom) return custom.icon;
    return defaultIcons[cat] || availableIcons[cat.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % availableIcons.length];
  };

  const getCategoryGradient = (cat: string) => {
    const custom = customCategories.find(c => c.name === cat);
    if (custom) return custom.gradient;
    return defaultGradients[cat] || availableGradients[cat.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % availableGradients.length];
  };

  const sortedCategories = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]);
  const appsInCategory = selectedCat ? localApps.filter(a => a.category === selectedCat) : [];

  // --- Pencarian (seluruh kategori) + pagination ---
  const searchTerm = searchQuery.trim().toLowerCase();
  const filteredCategories = searchTerm
    ? sortedCategories.filter(([cat]) => cat.toLowerCase().includes(searchTerm))
    : sortedCategories;

  const totalPages = Math.max(1, Math.ceil(filteredCategories.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageCategories = filteredCategories.slice(pageStart, pageStart + pageSize);

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
    setSaving(true);
    setFormError(null);
    try {
      if (editingCategory) {
        const res = await fetch(`/api/categories/${encodeURIComponent(editingCategory)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setSaving(false);
          setFormError(data?.error || 'Gagal memperbarui kategori');
          return;
        }
        // Pertahankan ikon/warna kategori di localStorage untuk nama baru.
        setCustomCategories(prev => {
          const updated = prev.map(c => c.name === editingCategory ? { ...c, name } : c);
          localStorage.setItem('custom_categories', JSON.stringify(updated));
          return updated;
        });
      } else {
        const res = await fetch('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setSaving(false);
          setFormError(data?.error || 'Gagal menambah kategori');
          return;
        }
      }
      setSaving(false);
      setShowAddModal(false);
      setEditingCategory(null);
      setFormData({ name: '', icon: 'fas fa-tag', gradient: availableGradients[0] });
      refreshAll();
    } catch (e) {
      console.error('Gagal menyimpan kategori:', e);
      setSaving(false);
      setFormError('Terjadi kesalahan saat menyimpan kategori');
    }
  };

  const handleEdit = (cat: string) => {
    const icon = getCategoryIcon(cat);
    const gradient = getCategoryGradient(cat);
    setFormData({ name: cat, icon, gradient });
    setEditingCategory(cat);
    setFormError(null);
    setShowAddModal(true);
  };

  const handleDelete = async (cat: string) => {
    setDeleting(cat);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/categories/${encodeURIComponent(cat)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteError(data?.error || 'Gagal menghapus kategori');
        setDeleting(null);
        return;
      }
    } catch (e) {
      console.error('Gagal menghapus kategori:', e);
      setDeleteError('Terjadi kesalahan saat menghapus kategori');
      setDeleting(null);
      return;
    }
    setDeleting(null);
    setShowDeleteConfirm(null);
    setCustomCategories(prev => {
      const updated = prev.filter(c => c.name !== cat);
      localStorage.setItem('custom_categories', JSON.stringify(updated));
      return updated;
    });
    refreshAll();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <SearchAutocomplete
            items={sortedCategories.map(([name]) => name)}
            getLabel={(name) => name}
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Cari nama kategori..."
            className="flex-1 sm:flex-none sm:w-64 min-w-[180px]"
          />
          {canManage && (
            <button onClick={() => { setEditingCategory(null); setFormData({ name: '', icon: 'fas fa-tag', gradient: availableGradients[0] }); setFormError(null); setShowAddModal(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-full hover:bg-blue-700 flex items-center gap-2 text-sm font-medium shrink-0">
              <i className="fas fa-plus"></i> <span className="hidden sm:inline">Tambah Kategori</span>
            </button>
          )}
        </div>
      </div>

      {filteredCategories.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 py-14 px-6 text-center">
          <div className="mx-auto w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
            <i className="fas fa-magnifying-glass text-sm"></i>
          </div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Tidak ada kategori yang cocok</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Coba kata kunci lain atau hapus pencarian.</p>
          <button
            onClick={() => setSearchQuery('')}
            className="mt-4 inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-700 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <i className="fas fa-rotate-left"></i> Hapus pencarian
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {pageCategories.map(([cat, count]) => {
          const icon = getCategoryIcon(cat);
          const gradient = getCategoryGradient(cat);
          return (
            <div key={cat} onClick={() => setSelectedCat(cat)} className="group relative bg-white/80 dark:bg-slate-800/60 backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-slate-700/50 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden cursor-pointer">
              <div className={`absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-[0.07] transition-opacity ${gradient} pointer-events-none`} />
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white shadow-lg`}>
                    <i className={`${icon} text-lg`}></i>
                  </div>
                  <div className="flex items-center gap-1">
                    {canManage && (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); handleEdit(cat); }} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"><i className="fas fa-pen text-xs"></i></button>
                        <button onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(cat); }} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"><i className="fas fa-trash text-xs"></i></button>
                      </>
                    )}
                  </div>
                </div>
                <div data-cat={cat}>
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{cat}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{count} aplikasi</p>
                  <div className="mt-3 space-y-1.5">
                    {localApps.filter(a => a.category === cat).slice(0, 3).map(app => (
                      <div key={app.id} className="flex items-center gap-2 text-xs">
                        <div className={`w-6 h-6 rounded-md bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0`}>{app.name.substring(0, 2).toUpperCase()}</div>
                        <span className="text-slate-600 dark:text-slate-300 truncate">{app.name}</span>
                      </div>
                    ))}
                  </div>
                  {count > 3 && <p className="text-xs text-slate-400 mt-2">+{count - 3} lainnya</p>}
                  <div className="mt-3 flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                    Klik untuk lihat detail <i className="fas fa-arrow-right text-[10px]"></i>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        </div>
      )}

      {/* Pagination */}
      {filteredCategories.length > 0 && (
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1">
          <p role="status" className="text-xs text-slate-400 dark:text-slate-500 tabular-nums order-2 lg:order-1">
            Menampilkan <span className="font-medium text-slate-600 dark:text-slate-300">{pageStart + 1}</span>–<span className="font-medium text-slate-600 dark:text-slate-300">{pageStart + pageCategories.length}</span> dari <span className="font-medium text-slate-600 dark:text-slate-300">{filteredCategories.length}</span> kategori
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
                className="w-12 h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-center text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 tabular-nums"
                aria-label="Lompat ke halaman"
              />
            </div>

            {/* Ukuran halaman */}
            <div className="relative">
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="h-8 appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-2.5 pr-7 text-xs text-slate-600 dark:text-slate-300 outline-none transition-shadow focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 cursor-pointer"
                aria-label="Jumlah kategori per halaman"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={() => { setShowAddModal(false); setEditingCategory(null); }}>
          <div className="bg-white/90 dark:bg-slate-900 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/60 dark:border-slate-700/50 w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200/60 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/50">
              <button onClick={() => { setShowAddModal(false); setEditingCategory(null); }} className="w-3 h-3 rounded-full bg-red-400 hover:bg-red-500 transition-colors" />
              <span className="w-3 h-3 rounded-full bg-amber-400" />
              <span className="w-3 h-3 rounded-full bg-emerald-400" />
              <p className="ml-2 text-sm font-medium text-slate-600 dark:text-slate-300">{editingCategory ? 'Edit Kategori' : 'Tambah Kategori'}</p>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 block">Nama Kategori</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="cth. Frontend" className="w-full bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent" autoFocus />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 block">Ikon</label>
                <div className="grid grid-cols-6 gap-2">
                  {availableIcons.map(ic => (
                    <button key={ic} type="button" onClick={() => setFormData({ ...formData, icon: ic })} className={`p-2.5 rounded-lg flex items-center justify-center transition-all ${formData.icon === ic ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 ring-2 ring-blue-500' : 'bg-slate-50 dark:bg-slate-700/50 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}><i className={ic}></i></button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 block">Warna</label>
                <div className="flex gap-2">
                  {availableGradients.map(gr => (
                    <button key={gr} type="button" onClick={() => setFormData({ ...formData, gradient: gr })} className={`w-8 h-8 rounded-lg bg-gradient-to-br ${gr} transition-all ${formData.gradient === gr ? 'ring-2 ring-offset-2 ring-slate-400 dark:ring-offset-slate-800 scale-110' : 'opacity-70 hover:opacity-100'}`} />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${formData.gradient} flex items-center justify-center text-white shadow-md`}><i className={formData.icon}></i></div>
                <p className="text-xs text-slate-400">Pratinjau</p>
              </div>
              {formError && (
                <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                  <i className="fas fa-circle-exclamation mt-0.5"></i>
                  <span>{formError}</span>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => { setShowAddModal(false); setEditingCategory(null); }} className="px-4 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-60" disabled={saving}>Batal</button>
                <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2">
                  {saving && <i className="fas fa-spinner fa-spin text-xs"></i>}
                  {saving ? 'Menyimpan...' : editingCategory ? 'Simpan' : 'Tambah'}
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
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">Hapus Kategori?</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Kategori &quot;{showDeleteConfirm}&quot; akan dihapus permanen. Aplikasi di dalamnya dipindah ke &quot;Uncategorized&quot;.</p>
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

      {selectedCat && (
        <div className={`fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm transition-opacity duration-300 ${isClosing ? 'opacity-0' : 'opacity-100'}`} onClick={handleClose}>
          <div className={`relative w-full max-w-md h-full bg-white dark:bg-slate-800 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${isClosing ? 'translate-x-full' : 'translate-x-0'}`} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{selectedCat}</h2>
              <button onClick={handleClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"><i className="fas fa-times"></i></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-2">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{appsInCategory.length} aplikasi dalam kategori ini</p>
              {appsInCategory.map(app => (
                <div key={app.id} onClick={() => router.push(`/apps?app=${app.id}`)} className="group/app flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/30 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors cursor-pointer">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold bg-gradient-to-br ${getCategoryGradient(selectedCat)}`}>{app.name.substring(0, 2).toUpperCase()}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{app.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{app.description}</p>
                  </div>
                  <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${app.status === 'active' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>{app.status}</span>
                  <i className="fas fa-arrow-right text-xs text-slate-300 dark:text-slate-600 group-hover/app:text-blue-500 transition-colors"></i>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
