"use client";

/* Halaman Akun & Keamanan — tiga bagian dalam satu halaman:
 *
 *   1. Akun Admin   — daftar akun, buat baru, ubah peran, hapus.
 *   2. Sesi Aktif   — siapa sedang masuk dari perangkat apa, dengan pencabutan.
 *   3. Jejak Login  — percobaan masuk yang berhasil DAN gagal.
 *
 * Ketiganya digabung karena saling menjelaskan: mengubah peran mencabut sesi,
 * dan sesi yang mencurigakan biasanya baru masuk akal setelah melihat jejak
 * login yang mendahuluinya. Memisahnya menjadi tiga halaman akan memaksa
 * superadmin berpindah-pindah untuk satu penyelidikan yang sama.
 *
 * SEMUA wewenang di sini ditegakkan di SERVER (`requireRole` di setiap route).
 * Menyembunyikan tombol di berkas ini bukan pengamanan — hanya kenyamanan.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { AdminAccount, ActiveSession, LoginLog } from '@/lib/admins';
import { ROLE_DESCRIPTION, ROLE_LABEL, VALID_ROLES, type Role } from '@/lib/roles';
import { LIMITS } from '@/lib/validate';

interface Props {
  /** Peran pemilik sesi — dipakai untuk menyembunyikan aksi yang pasti ditolak server. */
  currentRole: Role;
  currentAdminId: number;
}

const LOG_PAGE_SIZE = 25;

/**
 * Ringkas user-agent menjadi "Peramban · Sistem".
 *
 * Sengaja didefinisikan DI SINI, bukan di `src/lib/requestIdentity.ts`: modul
 * itu mengimpor `crypto` Node dan `NextRequest`, jadi mengimpornya dari
 * Client Component akan menarik dependensi server ke bundel browser.
 */
function describeUserAgent(ua: string | null): string {
  if (!ua) return 'Perangkat tidak diketahui';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua) && /Version\//.test(ua)
          ? 'Safari'
          : /Firefox\//.test(ua)
            ? 'Firefox'
            : /curl\//i.test(ua)
              ? 'curl'
              : 'Peramban lain';
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /Android/.test(ua)
      ? 'Android'
      : /iPhone|iPad|iOS/.test(ua)
        ? 'iOS'
        : /Mac OS X/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'Sistem lain';
  return `${browser} · ${os}`;
}

/** Ikon perangkat kasar dari user-agent — hanya isyarat visual. */
function deviceIcon(ua: string | null): string {
  if (!ua) return 'fa-circle-question';
  if (/Android|iPhone|iPad|Mobile/.test(ua)) return 'fa-mobile-screen';
  if (/curl|wget|python|bot/i.test(ua)) return 'fa-terminal';
  return 'fa-desktop';
}

const REASON_LABEL: Record<string, string> = {
  user_not_found: 'Username tidak dikenal',
  wrong_password: 'Password salah',
  invalid_input: 'Masukan tidak valid',
  rate_limited: 'Diblokir sementara (rate limit)',
};

function fullTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function shortDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

const ROLE_CHIP: Record<Role, string> = {
  superadmin: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  admin: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  viewer: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
};

function SectionCard({
  title,
  icon,
  hint,
  action,
  children,
}: {
  title: string;
  icon: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-700 flex flex-wrap items-center gap-3">
        <i className={`${icon} text-slate-400 text-sm`}></i>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h2>
          {hint && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{hint}</p>
          )}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function EmptyState({ icon, title, note }: { icon: string; title: string; note: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 py-10 px-6 text-center">
      <div className="mx-auto w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
        <i className={`fas ${icon} text-sm`}></i>
      </div>
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{title}</p>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{note}</p>
    </div>
  );
}

const btnGhost =
  'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-700 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 disabled:pointer-events-none';
const btnDanger =
  'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-800/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-50 disabled:pointer-events-none';
const btnPrimary =
  'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-60 disabled:pointer-events-none';
const inputClass =
  'w-full bg-slate-50/80 dark:bg-slate-700/50 border border-slate-200/60 dark:border-slate-600/50 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all';
const labelClass = 'block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5';
const selectClass =
  'h-8 appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-2.5 pr-7 text-xs text-slate-700 dark:text-slate-200 outline-none transition-shadow focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 cursor-pointer disabled:opacity-50';

export default function UsersPage({ currentRole, currentAdminId }: Props) {
  const isSuper = currentRole === 'superadmin';

  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [logs, setLogs] = useState<LoginLog[]>([]);
  const [logTotal, setLogTotal] = useState(0);
  const [failed24h, setFailed24h] = useState(0);

  const [logPage, setLogPage] = useState(1);
  const [logSuccess, setLogSuccess] = useState<'all' | 'true' | 'false'>('all');
  const [logSearch, setLogSearch] = useState('');

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Form akun baru
  const [showForm, setShowForm] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'viewer' as Role });

  const loadAccounts = useCallback(async () => {
    try {
      const [aRes, sRes] = await Promise.all([fetch('/api/admins'), fetch('/api/sessions')]);
      if (aRes.ok) {
        const data = await aRes.json();
        setAdmins(Array.isArray(data.admins) ? data.admins : []);
      }
      if (sRes.ok) {
        const data = await sRes.json();
        setSessions(Array.isArray(data.sessions) ? data.sessions : []);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (logSuccess !== 'all') qs.set('success', logSuccess);
      const term = logSearch.trim();
      if (term) qs.set('search', term);
      qs.set('limit', String(LOG_PAGE_SIZE));
      qs.set('offset', String((logPage - 1) * LOG_PAGE_SIZE));
      const res = await fetch(`/api/login-logs?${qs.toString()}`);
      if (!res.ok) {
        if (res.status === 403) return;
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Gagal memuat jejak login (HTTP ${res.status})`);
      }
      const data = await res.json();
      setLogs(Array.isArray(data.logs) ? data.logs : []);
      setLogTotal(typeof data.total === 'number' ? data.total : 0);
      setFailed24h(typeof data.failed24h === 'number' ? data.failed24h : 0);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [logSuccess, logSearch, logPage]);

  useEffect(() => {
    let alive = true;
    (async () => {
      await loadAccounts();
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [loadAccounts]);

  // Filter jejak login di-debounce: mengetik di kotak cari tidak perlu
  // memanggil server per karakter.
  useEffect(() => {
    const t = setTimeout(loadLogs, 300);
    return () => clearTimeout(t);
  }, [loadLogs]);

  // Kembali ke halaman 1 saat filter berubah.
  useEffect(() => {
    setLogPage(1); // eslint-disable-line react-hooks/set-state-in-effect
  }, [logSuccess, logSearch]);

  /** Pembungkus aksi: satu tempat untuk status sibuk, galat, dan pesan sukses. */
  const run = useCallback(
    async (key: string, fn: () => Promise<Response>, okMessage: string) => {
      setBusy(key);
      setError(null);
      setNotice(null);
      try {
        const res = await fn();
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setError(data?.error || `Gagal (HTTP ${res.status})`);
          return false;
        }
        setNotice(okMessage);
        await loadAccounts();
        await loadLogs();
        return true;
      } catch (e) {
        setError((e as Error).message);
        return false;
      } finally {
        setBusy(null);
      }
    },
    [loadAccounts, loadLogs]
  );

  const createAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await run(
      'create',
      () =>
        fetch('/api/admins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newUser),
        }),
      `Akun "${newUser.username}" dibuat.`
    );
    if (ok) {
      setNewUser({ username: '', password: '', role: 'viewer' });
      setShowForm(false);
    }
  };

  const changeRole = (account: AdminAccount, role: Role) =>
    run(
      `role-${account.id}`,
      () =>
        fetch(`/api/admins/${account.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role }),
        }),
      // Perubahan peran mencabut sesi milik akun itu — sebut agar tidak
      // mengejutkan ("kok dia tiba-tiba keluar?").
      `Peran ${account.username} menjadi ${ROLE_LABEL[role]}. Sesi lamanya dicabut.`
    );

  const removeAccount = (account: AdminAccount) => {
    if (
      !window.confirm(
        `Hapus akun "${account.username}"? Sesi dan riwayatnya ikut terpengaruh. Tindakan ini tidak dapat dibatalkan.`
      )
    )
      return;
    return run(
      `del-${account.id}`,
      () => fetch(`/api/admins/${account.id}`, { method: 'DELETE' }),
      `Akun "${account.username}" dihapus.`
    );
  };

  const revoke = (session: ActiveSession) => {
    if (!window.confirm(`Cabut sesi ${session.username} (${describeUserAgent(session.userAgent)})?`))
      return;
    return run(
      `sess-${session.id}`,
      () => fetch(`/api/sessions/${session.id}`, { method: 'DELETE' }),
      `Sesi ${session.username} dicabut.`
    );
  };

  const logPages = Math.max(1, Math.ceil(logTotal / LOG_PAGE_SIZE));
  const safeLogPage = Math.min(logPage, logPages);

  const roleCounts = useMemo(() => {
    const counts: Record<Role, number> = { superadmin: 0, admin: 0, viewer: 0 };
    for (const a of admins) counts[a.role] = (counts[a.role] ?? 0) + 1;
    return counts;
  }, [admins]);

  // Superadmin terakhir tidak boleh diturunkan/dihapus — server menolaknya,
  // dan tombolnya dimatikan di sini supaya tidak terasa seperti bug.
  const lastSuperadmin = roleCounts.superadmin <= 1;

  if (!isSuper) {
    return (
      <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3.5 flex items-start gap-3">
        <i className="fas fa-lock text-amber-500 mt-0.5"></i>
        <div>
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            Halaman ini hanya untuk Superadmin
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
            Peran akun Anda saat ini: {ROLE_LABEL[currentRole]}. Hubungi superadmin bila Anda
            memerlukan akses pengelolaan akun.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pesan */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-600 dark:text-red-400"
        >
          <i className="fas fa-circle-exclamation mt-0.5"></i>
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} aria-label="Tutup pesan galat">
            <i className="fas fa-xmark text-xs"></i>
          </button>
        </div>
      )}
      {notice && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400"
        >
          <i className="fas fa-circle-check mt-0.5"></i>
          <span className="flex-1">{notice}</span>
          <button onClick={() => setNotice(null)} aria-label="Tutup pesan">
            <i className="fas fa-xmark text-xs"></i>
          </button>
        </div>
      )}

      {/* Ringkasan */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: 'Total Akun',
            value: admins.length,
            icon: 'fa-users',
            tone: 'text-slate-800 dark:text-slate-100',
          },
          {
            label: 'Superadmin',
            value: roleCounts.superadmin,
            icon: 'fa-shield-halved',
            tone: 'text-blue-600 dark:text-blue-400',
          },
          {
            label: 'Sesi Aktif',
            value: sessions.length,
            icon: 'fa-plug-circle-check',
            tone: 'text-emerald-600 dark:text-emerald-400',
          },
          {
            label: 'Login Gagal 24 Jam',
            value: failed24h,
            icon: 'fa-triangle-exclamation',
            tone:
              failed24h > 0
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-slate-800 dark:text-slate-100',
          },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-5"
          >
            <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
              <i className={`fas ${s.icon} text-xs`}></i>
              <span className="text-[11px] font-medium uppercase tracking-wide">{s.label}</span>
            </div>
            <p className={`mt-2 text-2xl font-bold tabular-nums ${s.tone}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ============================ Akun Admin ============================ */}
      <SectionCard
        title="Akun Admin"
        icon="fas fa-users-gear"
        hint="Peran menentukan apa yang bisa diubah. Penegakannya di server, bukan di tampilan."
        action={
          <button onClick={() => setShowForm((v) => !v)} className={btnGhost}>
            <i className={`fas ${showForm ? 'fa-xmark' : 'fa-user-plus'} text-[10px]`}></i>
            {showForm ? 'Batal' : 'Akun baru'}
          </button>
        }
      >
        {showForm && (
          <form
            onSubmit={createAccount}
            className="mb-5 rounded-xl border border-slate-200/70 dark:border-slate-700/60 bg-slate-50/60 dark:bg-slate-900/40 p-4 space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="nu-username" className={labelClass}>
                  Username
                </label>
                <input
                  id="nu-username"
                  className={inputClass}
                  value={newUser.username}
                  onChange={(e) => setNewUser((p) => ({ ...p, username: e.target.value }))}
                  maxLength={LIMITS.username}
                  autoComplete="off"
                  required
                />
              </div>
              <div>
                <label htmlFor="nu-password" className={labelClass}>
                  Password
                </label>
                <input
                  id="nu-password"
                  type="password"
                  className={inputClass}
                  value={newUser.password}
                  onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))}
                  minLength={LIMITS.passwordMin}
                  maxLength={LIMITS.passwordMax}
                  autoComplete="new-password"
                  required
                />
                <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                  Minimal {LIMITS.passwordMin} karakter.
                </p>
              </div>
              <div>
                <label htmlFor="nu-role" className={labelClass}>
                  Peran
                </label>
                <select
                  id="nu-role"
                  className={inputClass}
                  value={newUser.role}
                  onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value as Role }))}
                >
                  {VALID_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                  {ROLE_DESCRIPTION[newUser.role]}
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={busy === 'create'} className={btnPrimary}>
                <i
                  className={`fas ${busy === 'create' ? 'fa-spinner fa-spin' : 'fa-check'} text-xs`}
                ></i>
                Simpan akun
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div role="status" aria-label="Memuat akun" className="space-y-2">
            <span className="sr-only">Memuat akun…</span>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-12 rounded-lg bg-slate-100 dark:bg-slate-700/40 animate-pulse"
              />
            ))}
          </div>
        ) : admins.length === 0 ? (
          <EmptyState
            icon="fa-users"
            title="Daftar akun belum bisa dibaca"
            note="Bila fitur peran baru ditambahkan, pastikan migrasi 08 sudah dijalankan di database."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[620px]">
              <thead className="text-left text-xs text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th scope="col" className="py-2.5 pr-4 font-medium">
                    Akun
                  </th>
                  <th scope="col" className="py-2.5 pr-4 font-medium">
                    Peran
                  </th>
                  <th scope="col" className="py-2.5 pr-4 font-medium">
                    Sesi
                  </th>
                  <th scope="col" className="py-2.5 pr-4 font-medium">
                    Dibuat
                  </th>
                  <th scope="col" className="py-2.5 font-medium text-right">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {admins.map((a) => {
                  const isSelf = a.id === currentAdminId;
                  // Menurunkan diri sendiri, dan menurunkan superadmin terakhir,
                  // sama-sama ditolak server (409).
                  const locked = isSelf || (a.role === 'superadmin' && lastSuperadmin);
                  const lockReason = isSelf
                    ? 'Akun sendiri tidak bisa diubah/dihapus dari halaman ini'
                    : 'Ini superadmin terakhir';
                  return (
                    <tr
                      key={a.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                    >
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700/60 border border-slate-200/60 dark:border-slate-600/50 flex items-center justify-center text-slate-500 dark:text-slate-300 text-xs shrink-0">
                            <i className="fas fa-user"></i>
                          </span>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-800 dark:text-slate-100 truncate">
                              {a.username}
                              {isSelf && (
                                <span className="ml-2 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                                  Anda
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-slate-400 dark:text-slate-500">
                              {ROLE_DESCRIPTION[a.role]}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${ROLE_CHIP[a.role]}`}
                        >
                          {ROLE_LABEL[a.role]}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${a.activeSessions > 0 ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                          ></span>
                          {a.activeSessions}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
                        {shortDate(a.createdAt)}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center justify-end gap-2">
                          <div className="relative">
                            <select
                              value={a.role}
                              disabled={locked || busy === `role-${a.id}`}
                              onChange={(e) => changeRole(a, e.target.value as Role)}
                              className={selectClass}
                              aria-label={`Peran ${a.username}`}
                              title={locked ? lockReason : undefined}
                            >
                              {VALID_ROLES.map((r) => (
                                <option key={r} value={r}>
                                  {ROLE_LABEL[r]}
                                </option>
                              ))}
                            </select>
                            <i className="fas fa-chevron-down absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none"></i>
                          </div>
                          <button
                            onClick={() => removeAccount(a)}
                            disabled={locked || busy === `del-${a.id}`}
                            className={btnDanger}
                            title={locked ? lockReason : undefined}
                          >
                            <i
                              className={`fas ${busy === `del-${a.id}` ? 'fa-spinner fa-spin' : 'fa-trash'} text-[10px]`}
                            ></i>
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* ============================ Sesi Aktif ============================ */}
      <SectionCard
        title="Sesi Aktif"
        icon="fas fa-plug-circle-check"
        hint="Alamat IP disimpan sebagai hash (UU PDP 27/2022), jadi yang tampil sidik ringkasnya."
        action={
          <button onClick={loadAccounts} className={btnGhost}>
            <i className="fas fa-rotate text-[10px]"></i>
            Segarkan
          </button>
        }
      >
        {sessions.length === 0 ? (
          <EmptyState
            icon="fa-plug-circle-xmark"
            title="Tidak ada sesi aktif tercatat"
            note="Metadata sesi (perangkat & hash IP) mulai tercatat setelah migrasi 08 dijalankan."
          />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {sessions.map((s) => (
              <li key={s.id} className="py-3 first:pt-0 last:pb-0 flex flex-wrap items-center gap-3">
                <span className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-700/60 border border-slate-200/60 dark:border-slate-600/50 flex items-center justify-center text-slate-500 dark:text-slate-300 shrink-0">
                  <i className={`fas ${deviceIcon(s.userAgent)} text-sm`}></i>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                    {s.username}
                    {s.current && (
                      <span className="ml-2 inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                        Sesi ini
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    {describeUserAgent(s.userAgent)} · masuk {fullTime(s.createdAt)} · terakhir
                    aktif {s.lastSeenAt ? fullTime(s.lastSeenAt) : '—'} · berlaku sampai{' '}
                    {fullTime(s.expiresAt)}
                  </p>
                </div>
                <span
                  className="text-[10px] font-mono text-slate-300 dark:text-slate-600 hidden sm:inline"
                  title="Hash IP (8 karakter pertama)"
                >
                  {s.ipHash ? s.ipHash.slice(0, 8) : '—'}
                </span>
                <button
                  onClick={() => revoke(s)}
                  disabled={s.current || busy === `sess-${s.id}`}
                  className={btnDanger}
                  title={s.current ? 'Pakai tombol Keluar untuk mengakhiri sesi ini' : undefined}
                >
                  <i
                    className={`fas ${busy === `sess-${s.id}` ? 'fa-spinner fa-spin' : 'fa-ban'} text-[10px]`}
                  ></i>
                  Cabut
                </button>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* ============================ Jejak Login ============================ */}
      <SectionCard
        title="Jejak Login"
        icon="fas fa-fingerprint"
        hint="Percobaan yang GAGAL juga dicatat — justru pola itu yang menandakan percobaan masuk paksa."
      >
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <i className="fas fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 pointer-events-none"></i>
            <input
              value={logSearch}
              onChange={(e) => setLogSearch(e.target.value)}
              placeholder="Cari username yang dicoba…"
              aria-label="Cari username pada jejak login"
              className="w-full h-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 text-sm text-slate-700 dark:text-slate-200 outline-none transition-shadow focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            />
          </div>
          <div className="relative">
            <select
              value={logSuccess}
              onChange={(e) => setLogSuccess(e.target.value as 'all' | 'true' | 'false')}
              aria-label="Filter hasil login"
              className="h-10 appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-3 pr-8 text-sm text-slate-700 dark:text-slate-200 outline-none transition-shadow focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 cursor-pointer"
            >
              <option value="all">Semua hasil</option>
              <option value="true">Berhasil</option>
              <option value="false">Gagal</option>
            </select>
            <i className="fas fa-chevron-down absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none"></i>
          </div>
        </div>

        {logs.length === 0 ? (
          <EmptyState
            icon="fa-fingerprint"
            title="Belum ada jejak login"
            note="Catatan mulai terisi pada login berikutnya setelah migrasi 08 dijalankan."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[620px]">
                <thead className="text-left text-xs text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th scope="col" className="py-2.5 pr-4 font-medium">
                      Hasil
                    </th>
                    <th scope="col" className="py-2.5 pr-4 font-medium">
                      Username
                    </th>
                    <th scope="col" className="py-2.5 pr-4 font-medium">
                      Perangkat
                    </th>
                    <th scope="col" className="py-2.5 pr-4 font-medium">
                      Hash IP
                    </th>
                    <th scope="col" className="py-2.5 font-medium text-right">
                      Waktu
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {logs.map((l) => (
                    <tr
                      key={l.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                    >
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            l.success
                              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                              : 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400'
                          }`}
                        >
                          <i className={`fas ${l.success ? 'fa-check' : 'fa-xmark'} text-[9px]`}></i>
                          {l.success ? 'Berhasil' : 'Gagal'}
                        </span>
                        {!l.success && l.reason && (
                          <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                            {REASON_LABEL[l.reason] ?? l.reason}
                          </p>
                        )}
                      </td>
                      <td className="py-3 pr-4 font-medium text-slate-800 dark:text-slate-100 break-all">
                        {l.usernameAttempt}
                      </td>
                      <td className="py-3 pr-4 text-xs text-slate-500 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1.5">
                          <i
                            className={`fas ${deviceIcon(l.userAgent)} text-[10px] text-slate-300 dark:text-slate-600`}
                          ></i>
                          {describeUserAgent(l.userAgent)}
                        </span>
                      </td>
                      <td
                        className="py-3 pr-4 text-[10px] font-mono text-slate-400 dark:text-slate-500"
                        title="Hash IP (8 karakter pertama)"
                      >
                        {l.ipHash ? l.ipHash.slice(0, 8) : '—'}
                      </td>
                      <td className="py-3 text-right text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
                        {fullTime(l.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
              <p role="status" className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">
                Menampilkan{' '}
                <span className="font-medium text-slate-600 dark:text-slate-300">
                  {Math.min((safeLogPage - 1) * LOG_PAGE_SIZE + 1, logTotal)}
                </span>
                –
                <span className="font-medium text-slate-600 dark:text-slate-300">
                  {Math.min(safeLogPage * LOG_PAGE_SIZE, logTotal)}
                </span>{' '}
                dari{' '}
                <span className="font-medium text-slate-600 dark:text-slate-300">{logTotal}</span>{' '}
                catatan
              </p>
              <nav aria-label="Navigasi jejak login" className="flex items-center gap-2">
                <button
                  onClick={() => setLogPage((p) => Math.max(1, p - 1))}
                  disabled={safeLogPage <= 1}
                  className={btnGhost}
                  aria-label="Halaman sebelumnya"
                >
                  <i className="fas fa-chevron-left text-[10px]"></i>
                  Sebelumnya
                </button>
                <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  {safeLogPage} / {logPages}
                </span>
                <button
                  onClick={() => setLogPage((p) => Math.min(logPages, p + 1))}
                  disabled={safeLogPage >= logPages}
                  className={btnGhost}
                  aria-label="Halaman berikutnya"
                >
                  Berikutnya
                  <i className="fas fa-chevron-right text-[10px]"></i>
                </button>
              </nav>
            </div>
          </>
        )}
      </SectionCard>
    </div>
  );
}
