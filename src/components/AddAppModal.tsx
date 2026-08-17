"use client";
import React, { useMemo, useState } from 'react';
import { App } from '@/types';

interface AddAppModalProps {
  onClose: () => void;
  onAdd: (app: App) => Promise<{ ok: boolean; error?: string }>;
  nextId: number;
  initialApp?: App | null;
  categories: string[];
  technologies: string[];
}

const emptyForm = {
  name: '', category: '', status: 'active' as App['status'], env: 'development' as App['env'],
  url: '', owner: '', version: '1.0.0', progress: 0, description: '', tech: [] as string[], newTech: '', server: '', database: '',
};

export default function AddAppModal({ onClose, onAdd, nextId, initialApp, categories, technologies }: AddAppModalProps) {
  const isEdit = Boolean(initialApp);
  const [form, setForm] = useState(() => initialApp ? {
    name: initialApp.name,
    category: initialApp.category === 'Uncategorized' ? '' : initialApp.category,
    status: initialApp.status,
    env: initialApp.env,
    url: initialApp.url === '#' ? '' : initialApp.url,
    owner: initialApp.owner === '-' ? '' : initialApp.owner,
    version: initialApp.version,
    progress: initialApp.progress,
    description: initialApp.description,
    tech: [...initialApp.tech],
    newTech: '',
    server: initialApp.server === '-' ? '' : initialApp.server,
    database: initialApp.database === '-' ? '' : initialApp.database,
  } : emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Opsi kategori: data DB + kategori lama (bila bukan bagian dari data, mis. fallback).
  const categoryOptions = useMemo(() => {
    const set = new Set<string>(categories);
    if (form.category && form.category !== 'Uncategorized') set.add(form.category);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [categories, form.category]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: name === 'progress' ? Number(value) : value }));
  };

  const toggleTech = (t: string) => {
    setForm(prev => ({
      ...prev,
      tech: prev.tech.includes(t) ? prev.tech.filter(x => x !== t) : [...prev.tech, t],
    }));
  };

  const addCustomTech = () => {
    const t = form.newTech.trim();
    if (!t) return;
    setForm(prev => (prev.tech.includes(t) ? prev : { ...prev, tech: [...prev.tech, t], newTech: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || saving) return;
    setSaving(true);
    setError(null);
    const result = await onAdd({
      id: isEdit ? initialApp!.id : nextId,
      name: form.name.trim(),
      category: form.category.trim() || 'Uncategorized',
      status: form.status,
      env: form.env,
      url: form.url.trim() || '#',
      owner: form.owner.trim() || '-',
      version: form.version.trim(),
      progress: Math.min(100, Math.max(0, form.progress)),
      description: form.description.trim(),
      tech: form.tech,
      server: form.server.trim() || '-',
      database: form.database.trim() || '-',
    });
    if (result.ok) {
      onClose();
    } else {
      setSaving(false);
      setError(result.error || 'Terjadi kesalahan saat menyimpan');
    }
  };

  const ic = "w-full bg-slate-50/80 dark:bg-slate-700/50 border border-slate-200/60 dark:border-slate-600/50 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all disabled:opacity-60";
  const lc = "block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white/90 dark:bg-slate-900 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/60 dark:border-slate-700/50 w-full max-w-lg max-h-[90vh] overflow-y-auto mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200/60 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/50 sticky top-0 z-10">
          <button onClick={onClose} className="w-3 h-3 rounded-full bg-red-400 hover:bg-red-500 transition-colors" />
          <span className="w-3 h-3 rounded-full bg-amber-400" />
          <span className="w-3 h-3 rounded-full bg-emerald-400" />
          <p className="ml-2 text-sm font-medium text-slate-600 dark:text-slate-300">{isEdit ? 'Edit Aplikasi' : 'Tambah Aplikasi'}</p>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div><label className={lc}>Nama *</label><input name="name" value={form.name} onChange={handleChange} className={ic} placeholder="Nama aplikasi" required autoFocus disabled={saving} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lc}>Kategori</label>
              <select name="category" value={form.category} onChange={handleChange} className={ic} disabled={saving}>
                <option value="">Uncategorized</option>
                {categoryOptions.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div><label className={lc}>Status</label><select name="status" value={form.status} onChange={handleChange} className={ic} disabled={saving}><option value="active">Active</option><option value="inactive">Inactive</option><option value="maintenance">Maintenance</option><option value="deprecated">Deprecated</option></select></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lc}>Environment</label><select name="env" value={form.env} onChange={handleChange} className={ic} disabled={saving}><option value="development">Development</option><option value="staging">Staging</option><option value="production">Production</option></select></div>
            <div><label className={lc}>Progress (%)</label><input name="progress" type="number" min="0" max="100" value={form.progress} onChange={handleChange} className={ic} disabled={saving} /></div>
          </div>
          <div><label className={lc}>Deskripsi</label><textarea name="description" value={form.description} onChange={handleChange} className={ic + " resize-none"} rows={2} placeholder="Deskripsi singkat" disabled={saving} /></div>
          <div>
            <label className={lc}>Tech Stack <span className="font-normal text-slate-400">(pilih dari daftar)</span></label>
            <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-200/60 dark:border-slate-600/50 bg-slate-50/80 dark:bg-slate-700/50 p-2 space-y-1">
              {technologies.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-slate-500 px-1 py-1.5">Belum ada teknologi terdaftar — tambahkan lewat kolom di bawah.</p>
              ) : technologies.map(t => {
                const active = form.tech.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTech(t)}
                    disabled={saving}
                    aria-pressed={active}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${active ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600/60'}`}
                  >
                    <span className="truncate">{t}</span>
                    <i className={`fas ${active ? 'fa-check' : 'fa-plus'} text-[10px] ${active ? 'text-white/70' : 'text-slate-400'}`}></i>
                  </button>
                );
              })}
            </div>
            {form.tech.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {form.tech.map(t => (
                  <span key={t} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs">
                    {t}
                    <button type="button" onClick={() => toggleTech(t)} disabled={saving} aria-label={`Hapus ${t}`} className="outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded hover:text-red-500">
                      <i className="fas fa-xmark text-[10px]"></i>
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="mt-2 flex gap-2">
              <input
                value={form.newTech}
                onChange={(e) => setForm(prev => ({ ...prev, newTech: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomTech(); } }}
                placeholder="Nama teknologi baru… lalu Enter"
                disabled={saving}
                className={ic}
              />
              <button
                type="button"
                onClick={addCustomTech}
                disabled={saving || !form.newTech.trim()}
                className="px-3 py-2 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 shrink-0"
              >
                Tambah
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lc}>Owner</label><input name="owner" value={form.owner} onChange={handleChange} className={ic} disabled={saving} /></div>
            <div><label className={lc}>Version</label><input name="version" value={form.version} onChange={handleChange} className={ic} disabled={saving} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lc}>Server</label><input name="server" value={form.server} onChange={handleChange} className={ic} disabled={saving} /></div>
            <div><label className={lc}>Database</label><input name="database" value={form.database} onChange={handleChange} className={ic} disabled={saving} /></div>
          </div>
          <div><label className={lc}>URL</label><input name="url" value={form.url} onChange={handleChange} className={ic} placeholder="https://..." disabled={saving} /></div>
          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              <i className="fas fa-circle-exclamation mt-0.5"></i>
              <span>{error}</span>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-60" disabled={saving}>Batal</button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2">
              {saving && <i className="fas fa-spinner fa-spin text-xs"></i>}
              {saving ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
