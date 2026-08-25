"use client";

/**
 * Section "Riwayat Versi" di drawer detail aplikasi.
 *
 * Melengkapi tabel `app_changelogs` (migrasi 08): daftar entri per aplikasi,
 * tambah, ubah, dan hapus — semuanya lewat /api/changelogs yang menegakkan
 * peran `admin` di server. Pengguna `viewer` hanya melihat daftarnya.
 */
import React, { useCallback, useEffect, useState } from "react";
import type { AppChangelog, ChangelogKind } from "@/types";
import { LIMITS } from "@/lib/validate";
import { useRole } from "@/hooks/useRole";

const KIND_META: Record<ChangelogKind, { label: string; chip: string; icon: string }> = {
  feature: { label: "Fitur", chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", icon: "fa-wand-magic-sparkles" },
  fix: { label: "Perbaikan", chip: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", icon: "fa-screwdriver-wrench" },
  security: { label: "Keamanan", chip: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: "fa-shield-halved" },
  other: { label: "Lainnya", chip: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300", icon: "fa-circle-info" },
};

interface FormState {
  version: string;
  releasedAt: string;
  kind: ChangelogKind;
  notes: string;
  isPublic: boolean;
}

const EMPTY_FORM: FormState = { version: "", releasedAt: "", kind: "feature", notes: "", isPublic: true };

function shortDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export default function ChangelogSection({ appId }: { appId: number }) {
  const role = useRole();
  const canManage = role === "admin" || role === "superadmin";

  const [entries, setEntries] = useState<AppChangelog[] | null>(null);
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/changelogs?appId=${appId}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `Gagal memuat (HTTP ${res.status})`);
      setEntries(data.changelogs ?? []);
      setError(null);
    } catch {
      setEntries([]);
    }
  }, [appId]);

  // Muat awal + muat ulang bila appId berganti. `load` async — semua setState
  // terjadi setelah await fetch; aturan lint tidak bisa melihat itu sehingga
  // perlu pengecualian eksplisit (pola yang sama dengan LogsPage/SystemPage).
  useEffect(() => {
    load(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [load]);

  const startCreate = () => {
    setForm(EMPTY_FORM);
    setEditing("new");
    setError(null);
  };

  const startEdit = (entry: AppChangelog) => {
    setForm({
      version: entry.version,
      releasedAt: entry.releasedAt ?? "",
      kind: entry.kind,
      notes: entry.notes ?? "",
      isPublic: entry.isPublic,
    });
    setEditing(entry.id);
    setError(null);
  };

  const save = async () => {
    if (busy || !form.version.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const payload = {
        appId,
        version: form.version,
        releasedAt: form.releasedAt || null,
        kind: form.kind,
        notes: form.notes || null,
        isPublic: form.isPublic,
      };
      const res =
        editing === "new"
          ? await fetch("/api/changelogs", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
          : await fetch(`/api/changelogs/${editing}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `Gagal menyimpan (HTTP ${res.status})`);
      setEditing(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    if (!window.confirm("Hapus entri riwayat versi ini?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/changelogs/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `Gagal menghapus (HTTP ${res.status})`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Riwayat Versi
        </h4>
        {canManage && editing === null && (
          <button
            onClick={startCreate}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
          >
            <i className="fas fa-plus text-[10px]"></i> Tambah
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mb-2 rounded-lg bg-red-50 dark:bg-red-900/20 px-2.5 py-1.5 text-xs text-red-600 dark:text-red-400">
          <i className="fas fa-circle-exclamation mr-1.5"></i>{error}
        </p>
      )}

      {/* Form tambah/edit */}
      {canManage && editing !== null && (
        <div className="mb-3 space-y-2 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
          <input
            value={form.version}
            onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
            placeholder="cth. 1.2.0"
            maxLength={LIMITS.version}
            disabled={busy}
            className="w-full bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={form.releasedAt}
              onChange={(e) => setForm((f) => ({ ...f, releasedAt: e.target.value }))}
              disabled={busy}
              className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60"
            />
            <select
              value={form.kind}
              onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as ChangelogKind }))}
              disabled={busy}
              className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/30 cursor-pointer disabled:opacity-60"
            >
              {(Object.keys(KIND_META) as ChangelogKind[]).map((k) => (
                <option key={k} value={k}>{KIND_META[k].label}</option>
              ))}
            </select>
          </div>
          <textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Apa yang berubah pada versi ini…"
            rows={2}
            maxLength={LIMITS.changelogNotes}
            disabled={busy}
            className="w-full resize-none bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60"
          />
          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <input
              type="checkbox"
              checked={form.isPublic}
              onChange={(e) => setForm((f) => ({ ...f, isPublic: e.target.checked }))}
              disabled={busy}
              className="rounded border-slate-300 dark:border-slate-600"
            />
            Tampilkan di katalog publik
          </label>
          <div className="flex gap-2 pt-1">
            <button
              onClick={save}
              disabled={busy || !form.version.trim()}
              className="flex-1 bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 text-xs font-medium disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
            >
              {busy && <i className="fas fa-spinner fa-spin"></i>}
              Simpan
            </button>
            <button
              onClick={() => setEditing(null)}
              disabled={busy}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Daftar entri */}
      {entries === null ? (
        <p className="text-xs text-slate-400 dark:text-slate-500">Memuat…</p>
      ) : entries.length === 0 ? (
        <p className="text-xs text-slate-400 dark:text-slate-500">Belum ada riwayat versi.</p>
      ) : (
        <ol className="space-y-2.5">
          {entries.map((entry) => {
            const meta = KIND_META[entry.kind];
            return (
              <li key={entry.id} className="rounded-lg border border-slate-100 dark:border-slate-700 px-3 py-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">v{entry.version}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${meta.chip}`}>
                    <i className={`fas ${meta.icon} mr-1 text-[9px]`}></i>{meta.label}
                  </span>
                  {!entry.isPublic && (
                    <span title="Catatan internal — tidak tampil publik" className="text-slate-400 dark:text-slate-500">
                      <i className="fas fa-lock text-[10px]"></i>
                    </span>
                  )}
                  <span className="ml-auto text-[11px] text-slate-400 dark:text-slate-500">{shortDate(entry.releasedAt)}</span>
                  {canManage && (
                    <span className="inline-flex gap-1">
                      <button onClick={() => startEdit(entry)} aria-label="Ubah entri" className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 px-1">
                        <i className="fas fa-pen text-[11px]"></i>
                      </button>
                      <button onClick={() => remove(entry.id)} aria-label="Hapus entri" className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 px-1">
                        <i className="fas fa-trash text-[11px]"></i>
                      </button>
                    </span>
                  )}
                </div>
                {entry.notes && (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 whitespace-pre-wrap">{entry.notes}</p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
