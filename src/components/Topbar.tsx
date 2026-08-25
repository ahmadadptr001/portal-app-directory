"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { App } from '@/types';
import { useRealtime } from '@/hooks/useRealtime';
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { createPortal } from 'react-dom';
import MacBookProfileMockup from '@/components/Macbook';
import { ROLE_LABEL, type Role } from '@/lib/roles';

interface TopbarProps {
  title: string;
  toggleSidebar: () => void;
  isSidebarOpen: boolean;
  isDark: boolean;
  toggleTheme: () => void;
}

// --- Notifikasi: dibangun dari data aplikasi nyata (status + aplikasi baru) ---
type NotifType = 'alert' | 'warning' | 'success' | 'info';

interface NotifItem {
  key: string;
  type: NotifType;
  icon: string;
  title: string;
  desc: string;
  appId: number;
}

const SEVERITY: Record<NotifType, number> = { alert: 0, warning: 1, success: 2, info: 3 };

const NOTIF_COLOR: Record<NotifType, string> = {
  alert: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  warning: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  success: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
  info: 'bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-300',
};

function timeAgo(iso: string, now: number): string {
  const diff = now - new Date(iso).getTime();
  // Guard: data tidak valid / jam berbeda (mis. clock skew, ekstensi mengubah waktu) → jangan tampilkan angka negatif.
  if (Number.isNaN(diff) || diff < 0) return 'baru saja';
  if (diff < 60 * 1000) return 'baru saja';
  const hours = Math.floor(diff / (60 * 60 * 1000));
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.floor(hours / 24)} hari lalu`;
}

export default function Topbar({ title, toggleSidebar, isSidebarOpen, isDark, toggleTheme }: TopbarProps) {
  const router = useRouter();
  const [showNotif, setShowNotif] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showMacbook, setShowMacbook] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [user, setUser] = useState({ id: 0, username: '', role: '', createdAt: '' });

  // Data aplikasi untuk notifikasi + status "sudah dibaca" (disimpan di localStorage).
  const [apps, setApps] = useState<App[]>([]);
  const [readKeys, setReadKeys] = useState<Set<string>>(new Set());
  // "Sekarang" untuk perhitungan waktu. Dinisialisasi 0 (BUKAN Date.now())
  // supaya render server & hidrasi identik; nilai nyata diisi saat data
  // notifikasi dimuat (refreshNotifications) — `now` tidak pernah dirender
  // saat hidrasi karena daftar notifikasi masih kosong saat itu.
  const [now, setNow] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/profile');
        if (res.status === 401) {
          // Sesi tidak valid (mis. sudah kedaluwarsa) — bersihkan cookie lalu
          // kembali ke halaman login supaya tidak terjebak di halaman kosong.
          await fetch('/api/logout', { method: 'POST' }).catch(() => {});
          router.push('/login');
          return;
        }
        const data = await res.json();
        if (data.id) setUser(data);
      } catch {
        // Jaringan bermasalah — biarkan data saat ini.
      }
    })();
  }, [router]);

  const refreshNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/apps');
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.apps)) {
        setApps(data.apps);
        setNow(Date.now());
      }
    } catch {
      // Biarkan daftar saat ini bila gagal.
    }
  }, []);

  // Notifikasi ikut berubah otomatis saat aplikasi berubah (SSE + polling pengaman).
  useRealtime(refreshNotifications);

  useEffect(() => {
    const t = window.setTimeout(() => refreshNotifications(), 0);
    return () => window.clearTimeout(t);
  }, [refreshNotifications]);

  // Muat status "sudah dibaca" dari localStorage.
  useEffect(() => {
    try {
      const raw = localStorage.getItem('notif_read_v1');
      if (raw) setReadKeys(new Set(JSON.parse(raw))); // eslint-disable-line react-hooks/set-state-in-effect
    } catch {
      // abaikan
    }
  }, []);

  const notifs = useMemo<NotifItem[]>(() => {
    const list: NotifItem[] = [];
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    for (const a of apps) {
      if (a.status === 'deprecated') {
        list.push({ key: `deprecated-${a.id}`, type: 'alert', icon: 'fa-circle-exclamation', title: `${a.name} dihentikan`, desc: `${a.category} · v${a.version}`, appId: a.id });
      } else if (a.status === 'maintenance') {
        list.push({ key: `maintenance-${a.id}`, type: 'warning', icon: 'fa-screwdriver-wrench', title: `${a.name} dalam pemeliharaan`, desc: `${a.category} · ${a.env}`, appId: a.id });
      } else if (a.status === 'inactive') {
        list.push({ key: `inactive-${a.id}`, type: 'info', icon: 'fa-circle-pause', title: `${a.name} nonaktif`, desc: `${a.category} · ${a.env}`, appId: a.id });
      }
    }
    for (const a of apps) {
      if (a.createdAt && new Date(a.createdAt).getTime() >= weekAgo) {
        list.push({ key: `new-${a.id}`, type: 'success', icon: 'fa-plus', title: `${a.name} ditambahkan`, desc: timeAgo(a.createdAt, now), appId: a.id });
      }
    }
    return list.sort((x, y) => SEVERITY[x.type] - SEVERITY[y.type]);
  }, [apps, now]);

  const unreadCount = notifs.filter((n) => !readKeys.has(n.key)).length;

  const markNotificationsRead = (key?: string) => {
    const next = key ? new Set([...readKeys, key]) : new Set(notifs.map((n) => n.key));
    setReadKeys(next);
    try {
      localStorage.setItem('notif_read_v1', JSON.stringify(Array.from(next)));
    } catch {
      // abaikan
    }
  };

  const handleLogout = async () => {
    setShowLogoutConfirm(false);
    setShowProfile(false);
    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch {
      // Sesi di sisi server gagal dihapus — cookie tetap dibersihkan di bawah.
    }
    router.push('/login');
  };

  return (
    <header className="sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          aria-label={isSidebarOpen ? 'Tutup sidebar' : 'Buka sidebar'}
          className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-all duration-300 relative w-5 h-5 flex items-center justify-center"
        >
          <PanelLeftOpen className={`h-5 w-5 absolute transition-all duration-300 ${isSidebarOpen ? 'opacity-0 rotate-90' : 'opacity-100 rotate-0'}`} strokeWidth={2} />
          <PanelLeftClose className={`h-5 w-5 absolute transition-all duration-300 ${isSidebarOpen ? 'opacity-100 rotate-0' : 'opacity-0 -rotate-90'}`} strokeWidth={2} />
        </button>
        <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          {showProfile && <div className="fixed inset-0 z-40" onClick={() => setShowProfile(false)}></div>}
          <button
            onClick={() => setShowProfile(!showProfile)}
            className="flex items-center gap-3 p-1 pr-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
          >
            <div className="w-9 h-9 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center text-white font-semibold text-sm overflow-hidden">
              <img src={`https://api.dicebear.com/9.x/bottts/svg?seed=${user.username}`} alt={user.username} className="w-[80%] h-[80%] object-cover" />
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100 leading-tight">{user.username}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight">
                {ROLE_LABEL[user.role as Role] ?? user.role}
              </p>
            </div>
            <i className="fas fa-chevron-down text-xs text-slate-400 hidden sm:block"></i>
          </button>
          {showProfile && (
            <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 py-0 overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/50 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center text-white font-semibold overflow-hidden">
                  <img src={`https://api.dicebear.com/9.x/bottts/svg?seed=${user.username}`} alt={user.username} className="w-[80%] h-[80%] object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{user.username}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {ROLE_LABEL[user.role as Role] ?? user.role}
                  </p>
                </div>
              </div>
              <div className="py-1">
                {/* Jalan pulang ke sisi publik. Sejak `/` menjadi beranda
                    portal publik (bukan lagi redirect ke /dashboard), admin
                    butuh jalan untuk memeriksa hasil terbitannya seperti yang
                    dilihat warga. Dibuka di tab baru supaya pekerjaan di
                    dasbor tidak hilang. */}
                <a
                  href="/"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShowProfile(false)}
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-3 transition-colors"
                >
                  <i className="fas fa-globe w-4 text-slate-400"></i>
                  <span className="flex-1">Beranda Publik</span>
                  <i className="fas fa-arrow-up-right-from-square text-[9px] text-slate-300 dark:text-slate-500"></i>
                </a>
                <a
                  href="/katalog"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShowProfile(false)}
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-3 transition-colors"
                >
                  <i className="fas fa-list w-4 text-slate-400"></i>
                  <span className="flex-1">Katalog Publik</span>
                  <i className="fas fa-arrow-up-right-from-square text-[9px] text-slate-300 dark:text-slate-500"></i>
                </a>
              </div>
              <div className="border-t border-slate-100 dark:border-slate-700 py-1">
                <button onClick={() => { setShowMacbook(true); setShowProfile(false); }} className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-3 transition-colors">
                  <i className="fas fa-user w-4 text-slate-400"></i> Profil Saya
                </button>
                <Link
                  href="/help"
                  onClick={() => setShowProfile(false)}
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-3 transition-colors"
                >
                  <i className="fas fa-circle-question w-4 text-slate-400"></i> Bantuan
                </Link>
              </div>
              <div className="border-t border-slate-100 dark:border-slate-700 py-1">
                <button
                  onClick={() => { toggleTheme(); setShowProfile(false); }}
                  role="switch"
                  aria-checked={isDark}
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-3 transition-colors"
                >
                  <i className={`${isDark ? 'fas fa-sun' : 'fas fa-moon'} w-4 text-slate-400`}></i>
                  <span className="flex-1">{isDark ? 'Mode Terang' : 'Mode Gelap'}</span>
                  <span className={`w-8 h-4.5 rounded-full relative transition-colors ${isDark ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
                    <span className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${isDark ? 'translate-x-3.5' : 'translate-x-0'}`}></span>
                  </span>
                </button>
              </div>
              <div className="border-t border-slate-100 dark:border-slate-700 py-1">
                <button onClick={() => { setShowProfile(false); setShowLogoutConfirm(true); }} className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3 transition-colors">
                  <i className="fas fa-right-from-bracket w-4"></i> Keluar
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="relative">
          {showNotif && <div className="fixed inset-0 z-40" onClick={() => setShowNotif(false)}></div>}
          <button
            onClick={() => setShowNotif(!showNotif)}
            className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg"
            title="Notifikasi"
          >
            <i className="fas fa-bell text-lg"></i>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center tabular-nums">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          {showNotif && (
            <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden z-50">
              <div className="px-2.5 py-2 flex justify-between items-center border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/50">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">Notifikasi</span>
                {unreadCount > 0 && (
                  <button onClick={() => markNotificationsRead()} className="text-[10px] text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium">Tandai dibaca</button>
                )}
              </div>
              {notifs.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <div className="mx-auto w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center text-slate-400 mb-2">
                    <i className="fas fa-bell-slash text-sm"></i>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Tidak ada notifikasi</p>
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                  {notifs.slice(0, 7).map((n) => (
                    <button
                      key={n.key}
                      onClick={() => { markNotificationsRead(n.key); setShowNotif(false); router.push(`/apps?app=${n.appId}`); }}
                      className={`w-full px-2.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer flex gap-2 text-left transition-colors ${readKeys.has(n.key) ? 'opacity-60' : ''}`}
                    >
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${NOTIF_COLOR[n.type]}`}>
                        <i className={`fas ${n.icon} text-[8px]`}></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-800 dark:text-slate-100 truncate">{n.title}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">{n.desc}</p>
                      </div>
                      {!readKeys.has(n.key) && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0"></span>}
                    </button>
                  ))}
                  {notifs.length > 7 && (
                    <button
                      onClick={() => { setShowNotif(false); router.push('/apps'); }}
                      className="w-full px-2.5 py-2 text-center text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      Lihat semua aplikasi ({notifs.length})
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {showMacbook && typeof document !== 'undefined' && createPortal(
        <MacBookProfileMockup user={user} onClose={() => setShowMacbook(false)} onProfileUpdate={(newUsername) => setUser(prev => ({ ...prev, username: newUsername }))} />,
        document.body
      )}

      {/* ================= Konfirmasi Logout ================= */}
      {showLogoutConfirm && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={() => setShowLogoutConfirm(false)}>
          <div className="bg-white/90 dark:bg-slate-900 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/60 dark:border-slate-700/50 w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-right-from-bracket text-red-500"></i>
              </div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">Keluar dari Portal?</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Sesi Anda akan diakhiri dan Anda perlu login kembali untuk mengakses portal.
              </p>
              <div className="flex gap-2 mt-5">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 px-4 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleLogout}
                  className="flex-1 px-4 py-2 rounded-lg text-sm bg-red-500 text-white hover:bg-red-600 transition-colors inline-flex items-center justify-center gap-2"
                >
                  <i className="fas fa-right-from-bracket text-xs"></i> Keluar
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </header>
  );
}
