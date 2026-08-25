"use client";
import React, { useMemo, useState } from 'react';
import { App, Screenshot } from '@/types';
import { LIMITS } from '@/lib/validate';

interface AddAppModalProps {
  onClose: () => void;
  onAdd: (app: App) => Promise<{ ok: boolean; error?: string }>;
  nextId: number;
  initialApp?: App | null;
  categories: string[];
  technologies: string[];
}

/** Baris screenshot di form (selalu ada minimal satu baris kosong). */
type ShotRow = { url: string; caption: string };

const emptyForm = {
  name: '', category: '', status: 'active' as App['status'], env: 'development' as App['env'],
  url: '', owner: '', version: '1.0.0', progress: 0, description: '', tech: [] as string[], newTech: '', server: '', database: '',
  // Profil publik
  slug: '', isPublic: false, logoUrl: '', goLiveDate: '',
  contactName: '', contactEmail: '', contactPhone: '',
  screenshots: [] as ShotRow[],
};

function toShotRows(shots: Screenshot[] | undefined): ShotRow[] {
  return (shots ?? []).map((s) => ({ url: s.url, caption: s.caption ?? '' }));
}

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
    slug: initialApp.slug ?? '',
    isPublic: Boolean(initialApp.isPublic),
    logoUrl: initialApp.logoUrl ?? '',
    goLiveDate: initialApp.goLiveDate ?? '',
    contactName: initialApp.contactName ?? '',
    contactEmail: initialApp.contactEmail ?? '',
    contactPhone: initialApp.contactPhone ?? '',
    screenshots: toShotRows(initialApp.screenshots),
  } : emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'teknis' | 'publik'>('teknis');

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

  // --- Screenshot ---
  const addShot = () => {
    setForm(prev => (prev.screenshots.length >= LIMITS.maxScreenshots
      ? prev
      : { ...prev, screenshots: [...prev.screenshots, { url: '', caption: '' }] }));
  };
  const removeShot = (index: number) => {
    setForm(prev => ({ ...prev, screenshots: prev.screenshots.filter((_, i) => i !== index) }));
  };
  const setShot = (index: number, key: keyof ShotRow, value: string) => {
    setForm(prev => ({
      ...prev,
      screenshots: prev.screenshots.map((s, i) => (i === index ? { ...s, [key]: value } : s)),
    }));
  };

  // Aplikasi produksi & aktif biasanya layak tampil publik — tapi TIDAK
  // dicentang otomatis. Banyak aplikasi internal juga "produksi & aktif"
  // (mis. aplikasi kepegawaian internal), dan menyalakan visibilitas publik
  // diam-diam justru kegagalan yang ingin dicegah oleh kolom is_public.
  // Jadi: beri saran, jangan bertindak sendiri.
  const suggestPublic = form.env === 'production' && form.status === 'active' && !form.isPublic;

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
      slug: form.slug.trim() || undefined,
      isPublic: form.isPublic,
      logoUrl: form.logoUrl.trim() || null,
      goLiveDate: form.goLiveDate.trim() || null,
      contactName: form.contactName.trim() || null,
      contactEmail: form.contactEmail.trim() || null,
      contactPhone: form.contactPhone.trim() || null,
      // Baris kosong dibuang di sini supaya server tidak perlu menebak.
      screenshots: form.screenshots
        .filter(s => s.url.trim())
        .map(s => ({ url: s.url.trim(), caption: s.caption.trim() || null })),
    });
    if (result.ok) {
      onClose();
    } else {
      setSaving(false);
      setError(result.error || 'Terjadi kesalahan saat menyimpan');
      // Pesan galat bisa berasal dari field di tab lain — pastikan terlihat.
      setTab('teknis');
    }
  };

  const ic = "w-full bg-slate-50/80 dark:bg-slate-700/50 border border-slate-200/60 dark:border-slate-600/50 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all disabled:opacity-60";
  const lc = "block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5";
  const hint = "mt-1 text-[11px] text-slate-400 dark:text-slate-500";
  const tabBtn = (active: boolean) =>
    `px-2.5 py-1.5 text-xs rounded-md transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${active ? 'bg-blue-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white/90 dark:bg-slate-900 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/60 dark:border-slate-700/50 w-full max-w-lg max-h-[90vh] overflow-y-auto mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200/60 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/50 sticky top-0 z-10">
          <button onClick={onClose} className="w-3 h-3 rounded-full bg-red-400 hover:bg-red-500 transition-colors" />
          <span className="w-3 h-3 rounded-full bg-amber-400" />
          <span className="w-3 h-3 rounded-full bg-emerald-400" />
          <p className="ml-2 text-sm font-medium text-slate-600 dark:text-slate-300">{isEdit ? 'Edit Aplikasi' : 'Tambah Aplikasi'}</p>
        </div>

        {/* Tab: form ini menampung dua hal berbeda — data teknis untuk
            pengelolaan internal, dan profil yang tampil di katalog publik. */}
        <div className="px-5 pt-4">
          <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 gap-0.5">
            <button type="button" onClick={() => setTab('teknis')} className={tabBtn(tab === 'teknis')} aria-pressed={tab === 'teknis'}>
              Data Teknis
            </button>
            <button type="button" onClick={() => setTab('publik')} className={tabBtn(tab === 'publik')} aria-pressed={tab === 'publik'}>
              Profil Publik
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* ---------------- TAB: DATA TEKNIS ---------------- */}
          <div className={tab === 'teknis' ? 'space-y-4' : 'hidden'}>
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
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${active ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600/60'}`}
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
                    <span key={t} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs">
                      {t}
                      <button type="button" onClick={() => toggleTech(t)} disabled={saving} aria-label={`Hapus ${t}`} className="outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded hover:text-red-500">
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
              <div><label className={lc}>Owner</label><input name="owner" value={form.owner} onChange={handleChange} className={ic} placeholder="Unit kerja / OPD" disabled={saving} /></div>
              <div><label className={lc}>Version</label><input name="version" value={form.version} onChange={handleChange} className={ic} disabled={saving} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lc}>Server</label><input name="server" value={form.server} onChange={handleChange} className={ic} disabled={saving} /></div>
              <div><label className={lc}>Database</label><input name="database" value={form.database} onChange={handleChange} className={ic} disabled={saving} /></div>
            </div>
            <div><label className={lc}>URL</label><input name="url" value={form.url} onChange={handleChange} className={ic} placeholder="https://..." disabled={saving} /></div>
            <p className={hint}>
              <i className="fas fa-lock text-[10px] mr-1"></i>
              Server, database, environment, dan progress hanya terlihat admin — tidak pernah ditampilkan di katalog publik.
            </p>
          </div>

          {/* ---------------- TAB: PROFIL PUBLIK ---------------- */}
          <div className={tab === 'publik' ? 'space-y-4' : 'hidden'}>
            {/* Visibilitas */}
            <div className="rounded-lg border border-slate-200/60 dark:border-slate-700/50 p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Tampilkan di katalog publik</p>
                  <p className={hint}>
                    Bila aktif, aplikasi ini bisa dilihat siapa saja tanpa login di /katalog.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.isPublic}
                  onClick={() => setForm(prev => ({ ...prev, isPublic: !prev.isPublic }))}
                  disabled={saving}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${form.isPublic ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-600'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.isPublic ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              {suggestPublic && (
                <p className="mt-2.5 flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-900/20 px-2.5 py-2 text-[11px] text-amber-700 dark:text-amber-400">
                  <i className="fas fa-lightbulb mt-0.5"></i>
                  <span>Aplikasi ini produksi &amp; aktif — biasanya layak tampil publik. Nyalakan bila memang untuk umum.</span>
                </p>
              )}
            </div>

            <div>
              <label className={lc}>Slug URL</label>
              <input name="slug" value={form.slug} onChange={handleChange} className={ic} placeholder={isEdit ? '' : 'otomatis dari nama aplikasi'} disabled={saving} />
              <p className={hint}>
                Alamat publiknya: <span className="font-mono">/katalog/{form.slug.trim() || '<otomatis>'}</span>.
                {isEdit && ' Slug tidak berubah otomatis saat nama diubah, supaya tautan yang sudah dibagikan tidak mati.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lc}>URL Logo</label>
                <input name="logoUrl" value={form.logoUrl} onChange={handleChange} className={ic} placeholder="https://..." disabled={saving} />
              </div>
              <div>
                <label className={lc}>Tanggal Go-Live</label>
                <input name="goLiveDate" type="date" value={form.goLiveDate} onChange={handleChange} className={ic} disabled={saving} />
              </div>
            </div>

            <div>
              <label className={lc}>Kontak Pengelola</label>
              <div className="space-y-2">
                <input name="contactName" value={form.contactName} onChange={handleChange} className={ic} placeholder="Nama / bidang penanggung jawab" disabled={saving} />
                <div className="grid grid-cols-2 gap-4">
                  <input name="contactEmail" type="email" value={form.contactEmail} onChange={handleChange} className={ic} placeholder="email@opd.go.id" disabled={saving} />
                  <input name="contactPhone" value={form.contactPhone} onChange={handleChange} className={ic} placeholder="0401-xxxxxx" disabled={saving} />
                </div>
              </div>
              <p className={hint}>Ditampilkan publik agar warga tahu ke mana bertanya. Jangan isi nomor pribadi.</p>
            </div>

            <div>
              <label className={lc}>
                Screenshot <span className="font-normal text-slate-400">(maks. {LIMITS.maxScreenshots})</span>
              </label>
              {form.screenshots.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">Belum ada screenshot.</p>
              ) : (
                <div className="space-y-2">
                  {form.screenshots.map((s, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <div className="flex-1 space-y-1.5">
                        <input
                          value={s.url}
                          onChange={(e) => setShot(i, 'url', e.target.value)}
                          className={ic}
                          placeholder="https://... (URL gambar)"
                          disabled={saving}
                          aria-label={`URL screenshot ${i + 1}`}
                        />
                        <input
                          value={s.caption}
                          onChange={(e) => setShot(i, 'caption', e.target.value)}
                          className={ic}
                          placeholder="Keterangan (opsional)"
                          disabled={saving}
                          aria-label={`Keterangan screenshot ${i + 1}`}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeShot(i)}
                        disabled={saving}
                        aria-label={`Hapus screenshot ${i + 1}`}
                        className="mt-2 p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        <i className="fas fa-trash text-xs"></i>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={addShot}
                disabled={saving || form.screenshots.length >= LIMITS.maxScreenshots}
                className="mt-2 inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
              >
                <i className="fas fa-plus text-[10px]"></i>
                Tambah screenshot
              </button>
              <p className={hint}>Tempel URL gambar yang sudah online. Belum ada fitur unggah berkas.</p>
            </div>
          </div>

          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              <i className="fas fa-circle-exclamation mt-0.5"></i>
              <span>{error}</span>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-60" disabled={saving}>Batal</button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2">
              {saving && <i className="fas fa-spinner fa-spin text-xs"></i>}
              {saving ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
