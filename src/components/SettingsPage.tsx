"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRealtime } from "@/hooks/useRealtime";
import { App } from "@/types";

interface SettingsPageProps {
  appEnv: string;
}

interface Status {
  ok: boolean;
  text: string;
}

const ic = "w-full bg-slate-50/80 dark:bg-slate-700/50 border border-slate-200/60 dark:border-slate-600/50 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all disabled:opacity-60";
const lc = "block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5";

function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2.5">
        <i className={`${icon} text-slate-400 dark:text-slate-500 text-sm`}></i>
        <h3 className="font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

function FieldStatus({ status }: { status: Status | null }) {
  if (!status) return null;
  return (
    <p
      role="status"
      className={`text-xs flex items-center gap-1.5 ${status.ok ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
    >
      <i className={`${status.ok ? "fas fa-circle-check" : "fas fa-circle-exclamation"}`}></i>
      {status.text}
    </p>
  );
}

export default function SettingsPage({ appEnv }: SettingsPageProps) {
  // --- Profil Admin ---
  const [profile, setProfile] = useState<{ id: number; username: string; role: string; createdAt: string } | null>(null);
  const [usernameDraft, setUsernameDraft] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<Status | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<Status | null>(null);

  // --- Preferensi tampilan ---
  const [cardView, setCardView] = useState<"grid" | "list">("grid");
  const [isDark, setIsDark] = useState(false);

  // --- Manajemen data ---
  const [counts, setCounts] = useState<{ apps: number; categories: number } | null>(null);
  const [backupStatus, setBackupStatus] = useState<Status | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<Status | null>(null);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<Status | null>(null);
  const [importPending, setImportPending] = useState<{ apps: App[]; categories: string[] } | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetStatus, setResetStatus] = useState<Status | null>(null);

  // --- Info sistem ---
  const [dbOnline, setDbOnline] = useState(true);

  const refreshCounts = useCallback(async () => {
    try {
      const [appsRes, catsRes] = await Promise.all([fetch("/api/apps"), fetch("/api/categories")]);
      const appsData = await appsRes.json().catch(() => ({}));
      const catsData = await catsRes.json().catch(() => ({}));
      setCounts({
        apps: appsRes.ok ? (appsData.apps?.length ?? 0) : 0,
        categories: catsRes.ok ? (catsData.categories?.length ?? 0) : 0,
      });
      setDbOnline(appsRes.ok && catsRes.ok);
    } catch {
      setDbOnline(false);
    }
  }, []);

  // Perubahan data (dari tab/admin lain) tampil otomatis.
  useRealtime(refreshCounts);

  useEffect(() => {
    fetch("/api/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.id) {
          setProfile(data);
          setUsernameDraft(data.username);
        }
      })
      .catch(() => {});
    const t = window.setTimeout(() => refreshCounts(), 0);

    const savedView = localStorage.getItem("app_card_view");
    if (savedView === "list" || savedView === "grid") setCardView(savedView); // eslint-disable-line react-hooks/set-state-in-effect
    setIsDark(localStorage.getItem("app_dark_mode") === "true");
    const handleCardViewChange = () => {
      const v = localStorage.getItem("app_card_view");
      if (v === "list" || v === "grid") setCardView(v);
    };
    const handleThemeChange = () => {
      setIsDark(localStorage.getItem("app_dark_mode") === "true");
    };
    window.addEventListener("cardViewChange", handleCardViewChange);
    window.addEventListener("themeChange", handleThemeChange);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("cardViewChange", handleCardViewChange);
      window.removeEventListener("themeChange", handleThemeChange);
    };
  }, [refreshCounts]);

  const toggleCardView = () => {
    const newView = cardView === "grid" ? "list" : "grid";
    setCardView(newView);
    localStorage.setItem("app_card_view", newView);
    window.dispatchEvent(new Event("cardViewChange"));
  };

  const toggleTheme = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    localStorage.setItem("app_dark_mode", String(newDark));
    window.dispatchEvent(new Event("themeChange"));
  };

  // --- Profil: ubah username ---
  const saveUsername = async () => {
    const username = usernameDraft.trim();
    if (!username || savingUsername || !profile) return;
    setSavingUsername(true);
    setUsernameStatus(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: profile.id, username }),
      });
      const data = await res.json();
      if (!res.ok) {
        setUsernameStatus({ ok: false, text: data?.error || "Gagal memperbarui username" });
        return;
      }
      setProfile((prev) => (prev ? { ...prev, username } : prev));
      setUsernameStatus({ ok: true, text: "Username berhasil diperbarui" });
    } catch {
      setUsernameStatus({ ok: false, text: "Gagal menghubungi server" });
    } finally {
      setSavingUsername(false);
    }
  };

  // --- Profil: ubah password ---
  const savePassword = async () => {
    if (savingPassword) return;
    if (!currentPassword || !newPassword) {
      setPasswordStatus({ ok: false, text: "Isi password saat ini dan password baru" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordStatus({ ok: false, text: "Konfirmasi password tidak cocok" });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordStatus({ ok: false, text: "Password baru minimal 6 karakter" });
      return;
    }
    setSavingPassword(true);
    setPasswordStatus(null);
    try {
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPasswordStatus({ ok: false, text: data?.error || "Gagal mengubah password" });
        return;
      }
      setPasswordStatus({ ok: true, text: "Password berhasil diubah" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setPasswordStatus({ ok: false, text: "Gagal menghubungi server" });
    } finally {
      setSavingPassword(false);
    }
  };

  // --- Data: backup ke localStorage ---
  const handleBackup = async () => {
    setBackupStatus(null);
    try {
      const [appsRes, catsRes] = await Promise.all([fetch("/api/apps"), fetch("/api/categories")]);
      const appsData = await appsRes.json();
      const catsData = await catsRes.json();
      const data = {
        apps: appsRes.ok ? (appsData.apps ?? []) : [],
        categories: catsRes.ok ? (catsData.categories ?? []) : [],
      };
      localStorage.setItem(
        "backup_data",
        JSON.stringify({ ...data, timestamp: new Date().toISOString() }),
      );
      setBackupStatus({
        ok: true,
        text: `Tersimpan di browser (${data.apps.length} aplikasi, ${data.categories.length} kategori)`,
      });
    } catch {
      setBackupStatus({ ok: false, text: "Gagal mengambil data untuk backup" });
    }
  };

  // --- Data: export file JSON ---
  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    setExportStatus(null);
    try {
      const [appsRes, catsRes] = await Promise.all([fetch("/api/apps"), fetch("/api/categories")]);
      const appsData = await appsRes.json();
      const catsData = await catsRes.json();
      const apps = appsRes.ok ? (appsData.apps ?? []) : [];
      const categories = catsRes.ok ? (catsData.categories ?? []) : [];
      const payload = {
        app: "Portal Direktori Aplikasi",
        exportedAt: new Date().toISOString(),
        categories,
        apps,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `portal-app-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setExportStatus({ ok: true, text: `File terunduh (${apps.length} aplikasi, ${categories.length} kategori)` });
    } catch {
      setExportStatus({ ok: false, text: "Gagal menyiapkan export" });
    } finally {
      setExporting(false);
    }
  };

  // --- Data: impor dari file ---
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStatus(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed.apps) || !Array.isArray(parsed.categories)) {
        throw new Error("format");
      }
      setImportPending({ apps: parsed.apps, categories: parsed.categories });
      setShowImportModal(true);
    } catch {
      setImportStatus({ ok: false, text: "File tidak valid — pilih file hasil Export/Backup (JSON)" });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const confirmImport = async () => {
    if (!importPending || importing) return;
    setImporting(true);
    setImportStatus(null);
    try {
      const res = await fetch("/api/admin/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(importPending),
      });
      const data = await res.json();
      if (!res.ok) {
        setImportStatus({ ok: false, text: data?.error || "Gagal impor data" });
        return;
      }
      setImportStatus({ ok: true, text: `Impor selesai: ${data.apps} aplikasi, ${data.categories} kategori` });
      setShowImportModal(false);
      setImportPending(null);
      refreshCounts();
    } catch {
      setImportStatus({ ok: false, text: "Gagal menghubungi server" });
    } finally {
      setImporting(false);
    }
  };

  // --- Data: reset semua ---
  const confirmReset = async () => {
    if (resetConfirm !== "HAPUS" || resetting) return;
    setResetting(true);
    setResetStatus(null);
    try {
      const res = await fetch("/api/admin/data", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setResetStatus({ ok: false, text: data?.error || "Gagal menghapus data" });
        return;
      }
      setResetStatus({ ok: true, text: "Semua data aplikasi & kategori telah dihapus" });
      setShowResetModal(false);
      setResetConfirm("");
      refreshCounts();
    } catch {
      setResetStatus({ ok: false, text: "Gagal menghubungi server" });
    } finally {
      setResetting(false);
    }
  };

  const isProd = appEnv === "production";
  const envLabel = isProd ? "Production" : "Development";
  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
    : "-";

  return (
    <div className="space-y-6">
      {/* ================= Profil Admin ================= */}
      <SectionCard title="Profil Admin" icon="fas fa-user-cog">
        <div className="flex items-center gap-4">
          {/* Avatar gambar — sama dengan avatar di header global (dicebear bottts, seed = username) */}
          <div className="w-12 h-12 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
            <img
              src={`https://api.dicebear.com/9.x/bottts/svg?seed=${profile?.username ?? ""}`}
              alt={profile?.username ?? "Admin"}
              className="w-[80%] h-[80%] object-cover"
            />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{profile?.username ?? "Memuat..."}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {profile?.role ?? "-"} · Anggota sejak {memberSince}
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-5">
          <div>
            <label className={lc}>Username</label>
            <div className="flex items-start gap-2">
              <input
                type="text"
                value={usernameDraft}
                onChange={(e) => setUsernameDraft(e.target.value)}
                className={ic}
                disabled={savingUsername}
                placeholder="Username"
              />
              <button
                onClick={saveUsername}
                disabled={savingUsername || !usernameDraft.trim()}
                className="h-9 px-4 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2 shrink-0"
              >
                {savingUsername && <i className="fas fa-spinner fa-spin text-xs"></i>}
                {savingUsername ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
            <div className="mt-1.5"><FieldStatus status={usernameStatus} /></div>
          </div>

          <div className="h-px bg-slate-100 dark:bg-slate-700"></div>

          <div>
            <label className={lc}>Ganti Password</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={ic}
                disabled={savingPassword}
                placeholder="Password saat ini"
                autoComplete="current-password"
              />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={ic}
                disabled={savingPassword}
                placeholder="Password baru"
                autoComplete="new-password"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={ic}
                disabled={savingPassword}
                placeholder="Ulangi password baru"
                autoComplete="new-password"
              />
            </div>
            <div className="mt-2 flex items-start gap-2 flex-wrap">
              <button
                onClick={savePassword}
                disabled={savingPassword}
                className="h-9 px-4 rounded-lg text-sm font-medium bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                {savingPassword && <i className="fas fa-spinner fa-spin text-xs"></i>}
                {savingPassword ? "Menyimpan..." : "Perbarui Password"}
              </button>
              <FieldStatus status={passwordStatus} />
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ================= Preferensi Tampilan ================= */}
      <SectionCard title="Preferensi Tampilan" icon="fas fa-display">
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          <div className="flex justify-between items-center py-3 first:pt-0 last:pb-0">
            <div className="flex items-center gap-3">
              <i className="fas fa-moon text-slate-400 dark:text-slate-500 w-5"></i>
              <div>
                <p className="font-medium text-slate-700 dark:text-slate-200">Tema Tampilan</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{isDark ? "Mode Gelap" : "Mode Terang"}</p>
              </div>
            </div>
            <button
              onClick={toggleTheme}
              aria-pressed={isDark}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isDark ? "bg-indigo-600" : "bg-slate-200 dark:bg-slate-600"}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isDark ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
          <div className="flex justify-between items-center py-3 first:pt-0 last:pb-0">
            <div className="flex items-center gap-3">
              <i className="fas fa-th-large text-slate-400 dark:text-slate-500 w-5"></i>
              <div>
                <p className="font-medium text-slate-700 dark:text-slate-200">Tampilan Kartu Aplikasi</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{cardView === "grid" ? "Tampilan Grid" : "Tampilan List"}</p>
              </div>
            </div>
            <button
              onClick={toggleCardView}
              aria-pressed={cardView === "list"}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${cardView === "list" ? "bg-indigo-600" : "bg-slate-200 dark:bg-slate-600"}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${cardView === "list" ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
        </div>
      </SectionCard>

      {/* ================= Manajemen Data ================= */}
      <SectionCard title="Manajemen Data" icon="fas fa-database">
        <div className="space-y-3">
          {/* Backup */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 border border-indigo-100 dark:border-indigo-800/40">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white shadow-md flex-shrink-0">
              <i className="fas fa-cloud-arrow-up"></i>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-slate-700 dark:text-slate-200">Backup Data</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Simpan snapshot data di browser (localStorage)</p>
              <FieldStatus status={backupStatus} />
            </div>
            <button
              onClick={handleBackup}
              className="h-9 px-4 rounded-lg text-sm font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors shrink-0"
            >
              Backup
            </button>
          </div>

          {/* Export */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-100 dark:border-emerald-800/40">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md flex-shrink-0">
              <i className="fas fa-file-export"></i>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-slate-700 dark:text-slate-200">Export Data</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Unduh seluruh data sebagai file JSON</p>
              <FieldStatus status={exportStatus} />
            </div>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="h-9 px-4 rounded-lg text-sm font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-emerald-400 dark:hover:border-emerald-600 transition-colors shrink-0 disabled:opacity-60 inline-flex items-center gap-2"
            >
              {exporting && <i className="fas fa-spinner fa-spin text-xs"></i>}
              {exporting ? "Menyiapkan..." : "Export JSON"}
            </button>
          </div>

          {/* Import */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-br from-sky-50 to-cyan-50 dark:from-sky-900/20 dark:to-cyan-900/20 border border-sky-100 dark:border-sky-800/40">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-sky-500 to-cyan-600 flex items-center justify-center text-white shadow-md flex-shrink-0">
              <i className="fas fa-file-import"></i>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-slate-700 dark:text-slate-200">Import / Restore</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Pulihkan dari file JSON — menggantikan data saat ini</p>
              <FieldStatus status={importStatus} />
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleImportFile}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="h-9 px-4 rounded-lg text-sm font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-sky-400 dark:hover:border-sky-600 transition-colors shrink-0"
            >
              Pilih File
            </button>
          </div>

          {/* Reset */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-br from-rose-50 to-red-50 dark:from-rose-900/20 dark:to-red-900/20 border border-rose-100 dark:border-rose-800/40">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center text-white shadow-md flex-shrink-0">
              <i className="fas fa-trash-can"></i>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-slate-700 dark:text-slate-200">Hapus Semua Data</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Kosongkan aplikasi & kategori — tidak bisa dibatalkan</p>
              <FieldStatus status={resetStatus} />
            </div>
            <button
              onClick={() => setShowResetModal(true)}
              className="h-9 px-4 rounded-lg text-sm font-medium bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:border-rose-400 dark:hover:border-rose-600 transition-colors shrink-0"
            >
              Reset
            </button>
          </div>
        </div>
      </SectionCard>

      {/* ================= Info Sistem ================= */}
      <SectionCard title="Info Sistem" icon="fas fa-server">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-500 dark:text-slate-400">Environment</dt>
            <dd>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide ${isProd ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"}`}>
                {envLabel}
              </span>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-500 dark:text-slate-400">Database</dt>
            <dd className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
              <span className={`w-1.5 h-1.5 rounded-full ${dbOnline ? "bg-emerald-500" : "bg-rose-500"}`}></span>
              {dbOnline ? "Tersambung" : "Terputus"}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-500 dark:text-slate-400">Total Aplikasi</dt>
            <dd className="font-medium text-slate-700 dark:text-slate-200 tabular-nums">{counts?.apps ?? "-"}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-500 dark:text-slate-400">Total Kategori</dt>
            <dd className="font-medium text-slate-700 dark:text-slate-200 tabular-nums">{counts?.categories ?? "-"}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-500 dark:text-slate-400">Versi Aplikasi</dt>
            <dd className="text-slate-700 dark:text-slate-200">v2.0</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-500 dark:text-slate-400">Login Sebagai</dt>
            <dd className="font-medium text-slate-700 dark:text-slate-200 truncate max-w-[180px]">{profile?.username ?? "-"}</dd>
          </div>
        </dl>
      </SectionCard>

      {/* ================= Modal Impor ================= */}
      {showImportModal && importPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={() => setShowImportModal(false)}>
          <div className="bg-white/90 dark:bg-slate-900 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/60 dark:border-slate-700/50 w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-file-import text-sky-600 dark:text-sky-400"></i>
              </div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">Impor Data?</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Impor akan <strong>menggantikan seluruh data saat ini</strong> ({importPending.apps.length} aplikasi, {importPending.categories.length} kategori).
              </p>
              <div className="flex gap-2 mt-5">
                <button
                  onClick={() => setShowImportModal(false)}
                  className="flex-1 px-4 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  disabled={importing}
                >
                  Batal
                </button>
                <button
                  onClick={confirmImport}
                  disabled={importing}
                  className="flex-1 px-4 py-2 rounded-lg text-sm bg-sky-600 text-white hover:bg-sky-700 transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2"
                >
                  {importing && <i className="fas fa-spinner fa-spin text-xs"></i>}
                  {importing ? "Mengimpor..." : "Impor"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= Modal Reset ================= */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={() => { setShowResetModal(false); setResetConfirm(""); }}>
          <div className="bg-white/90 dark:bg-slate-900 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/60 dark:border-slate-700/50 w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-triangle-exclamation text-red-500"></i>
              </div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">Hapus Semua Data?</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Seluruh aplikasi, kategori, dan tech stack akan dihapus permanen. Ketik <strong className="font-mono">HAPUS</strong> untuk konfirmasi.
              </p>
              <input
                type="text"
                value={resetConfirm}
                onChange={(e) => setResetConfirm(e.target.value)}
                placeholder="HAPUS"
                className="mt-4 w-full bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-center font-mono tracking-widest text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-red-500/40 focus:border-red-400 outline-none transition-all"
              />
              <div className="flex gap-2 mt-5">
                <button
                  onClick={() => { setShowResetModal(false); setResetConfirm(""); }}
                  className="flex-1 px-4 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  disabled={resetting}
                >
                  Batal
                </button>
                <button
                  onClick={confirmReset}
                  disabled={resetConfirm !== "HAPUS" || resetting}
                  className="flex-1 px-4 py-2 rounded-lg text-sm bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                >
                  {resetting && <i className="fas fa-spinner fa-spin text-xs"></i>}
                  {resetting ? "Menghapus..." : "Hapus Semua"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
