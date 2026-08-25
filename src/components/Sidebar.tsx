"use client";

import React, { useEffect, useRef, useLayoutEffect, useState } from 'react';
import Link from 'next/link';
import type { Role } from '@/lib/rolesShared';

interface SidebarProps {
  activePage: string;
  isOpen: boolean;
  toggle: () => void;
  appCount: number;
  appEnv: string;
}

const navItems = [
  { id: 'dashboard', icon: 'fas fa-chart-pie', label: 'Dashboard' },
  { id: 'apps', icon: 'fas fa-boxes', label: 'Daftar Aplikasi', badge: true },
  { id: 'categories', icon: 'fas fa-tags', label: 'Kategori' },
  { id: 'technologies', icon: 'fas fa-microchip', label: 'Teknologi' },
  { id: 'logs', icon: 'fas fa-clock-rotate-left', label: 'Log Aktivitas' },
  { id: 'system', icon: 'fas fa-heart-pulse', label: 'Kesehatan Sistem' },
  { id: 'users', icon: 'fas fa-users-gear', label: 'Akun & Keamanan' },
  { id: 'settings', icon: 'fas fa-cog', label: 'Pengaturan' },
];

/** Menu yang tidak berguna bagi `viewer` karena API-nya menolak peran itu. */
const VIEWER_HIDDEN = new Set(['system', 'users']);

export default function Sidebar({ activePage, isOpen, toggle, appCount, appEnv }: SidebarProps) {
  const navListRef = useRef<HTMLUListElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const [barTop, setBarTop] = useState(4);
  const [dbOnline, setDbOnline] = useState(true);
  // Peran sesi (dari endpoint yang sama dengan cek koneksi) — dipakai hanya
  // untuk menyembunyikan menu yang pasti ditolak server bagi viewer.
  const [role, setRole] = useState<Role | null>(null);
  const isProd = appEnv === 'production';
  const envLabel = isProd ? 'Production' : 'Development';

  // Cek koneksi sistem (sesi + database) secara berkala.
  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const res = await fetch('/api/profile', { method: 'GET' });
        if (!alive) return;
        setDbOnline(res.ok);
        if (res.ok) {
          const data = await res.json().catch(() => null);
          const r = data?.role;
          if (alive && (r === 'superadmin' || r === 'admin' || r === 'viewer')) {
            setRole(r as Role);
          }
        }
      } catch {
        if (alive) setDbOnline(false);
      }
    };
    check();
    const t = setInterval(check, 30000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const visibleItems =
    role === 'viewer'
      ? navItems.filter((item) => !VIEWER_HIDDEN.has(item.id))
      : navItems;

  // Posisikan indikator tepat di tengah item aktif berdasarkan posisi layout nyata,
  // sehingga selalu presisi di semua state (terbuka/tertutup) dan semua font.
  const measure = React.useCallback(() => {
    const ul = navListRef.current;
    const bar = barRef.current;
    if (!ul || !bar) return;
    const link = ul.querySelector(`a[href="/${activePage}"]`);
    if (!link) return;
    const ulRect = ul.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();
    const barHeight = bar.getBoundingClientRect().height;
    setBarTop(linkRect.top - ulRect.top + (linkRect.height - barHeight) / 2);
  }, [activePage]);

  useLayoutEffect(() => {
    measure();
    // Ukur ulang setelah transisi lebar sidebar selesai agar hasilnya presisi.
    const t = setTimeout(measure, 400);
    return () => clearTimeout(t);
  }, [measure, isOpen]);

  return (
    <aside className={`fixed inset-y-0 left-0 z-50 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 ease-in-out flex flex-col overflow-hidden whitespace-nowrap ${isOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-full md:translate-x-0 md:w-20'}`}>
      
      <div className={`flex items-center transition-all duration-300 ease-in-out ${isOpen ? 'px-4 justify-between' : 'px-0 justify-center'} py-5 border-b border-slate-200 dark:border-slate-800/50`}>
        <div className={`flex items-center ${isOpen ? 'gap-3' : 'gap-0'}`}>
          {/* Lambang Provinsi Sulawesi Tenggara (aset: public/img/logo-sultra.svg) */}
          <img
            src="/img/logo-sultra.svg"
            alt="Lambang Provinsi Sulawesi Tenggara"
            className="w-9 h-9 object-contain flex-shrink-0"
          />
          <div className={`transition-all duration-300 ease-in-out ${isOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
            <p className="text-sm font-bold text-slate-800 dark:text-white tracking-tight leading-tight">Direktori Aplikasi</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-tight">Provinsi Sulawesi Tenggara</p>
          </div>
        </div>
        <button onClick={toggle} className={`text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-all duration-300 ease-in-out ${isOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'} md:hidden`}>
          <i className="fas fa-xmark"></i>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <p className={`px-4 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 transition-all duration-300 ease-in-out ${isOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>Menu</p>
        <ul ref={navListRef} className="flex flex-col gap-1 relative">
          {/* Cahaya halus di belakang garis (nyaris tak terlihat) */}
          <span
            className="absolute left-0 w-1/3 h-9 -ml-3 bg-gradient-to-r from-blue-500/15 via-blue-500/5 to-transparent transition-all duration-300 ease-in-out pointer-events-none"
            style={{ top: `${barTop}px` }}
          />
          {/* Garis aktif — tetap dominan */}
          <span
            ref={barRef}
            className="absolute left-0 w-1 h-9 bg-blue-600 rounded-full -ml-3 transition-all duration-300 ease-in-out"
            style={{ top: `${barTop}px` }}
          />
          {visibleItems.map((item) => (
            <li key={item.id} className="list-none">
              <Link
                href={`/${item.id}`}
                className={`flex w-full items-center transition-all duration-300 ease-in-out ${isOpen ? 'gap-3 px-2' : 'justify-center px-0'} py-2.5 cursor-pointer rounded-xl ${activePage === item.id ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-200'}`}
              >
                <div className="relative w-7 flex items-center justify-center">
                  {/* Saat melebar: ikon lebih kecil agar seimbang dengan label; saat ciut: tetap besar agar terbaca di rail sempit */}
                  <i className={`${item.icon} leading-none ${isOpen ? 'text-base' : 'text-xl'}`}></i>
                  {item.badge && !isOpen && (
                    <span className="absolute -top-2.5 -right-3 bg-red-500 text-white text-[9px] px-1 py-0.5 rounded-full transition-all duration-300 ease-in-out opacity-100">{appCount}</span>
                  )}
                </div>
                <span className={`transition-all duration-300 ease-in-out ${isOpen ? 'flex-1 opacity-100 text-sm font-medium' : 'opacity-0 w-0 overflow-hidden'}`}>{item.label}</span>
                {item.badge && isOpen && (
                  <span className="bg-red-500 text-white text-xs py-0.5 px-2 rounded-full transition-all duration-300 ease-in-out opacity-100">{appCount}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className={`border-t border-slate-200 dark:border-slate-800/60 transition-all duration-300 ease-in-out ${isOpen ? 'px-3 py-3' : 'px-0 py-3'}`}>
        <div className={`rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/50 transition-all duration-300 ease-in-out ${isOpen ? 'p-3 space-y-2.5' : 'p-2'}`}>
          <div className={`flex items-center ${isOpen ? 'gap-2.5' : 'justify-center'}`}>
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700/60 border border-slate-200/60 dark:border-slate-600/50 flex items-center justify-center text-slate-500 dark:text-slate-300 text-base flex-shrink-0">
              <i className="fas fa-server"></i>
            </div>
            {isOpen && (
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">Status Sistem</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">Koneksi &amp; lingkungan</p>
              </div>
            )}
          </div>
          {isOpen && <div className="h-px bg-slate-200/70 dark:bg-slate-700/50"></div>}
          <div className={`flex items-center ${isOpen ? 'justify-between' : 'justify-center'}`}>
            <span className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500 dark:text-slate-400" title={dbOnline ? 'Sistem OK' : 'Tidak tersambung'}>
              {/* Dot status hanya tampil saat sidebar terbuka */}
              {isOpen && <span className={`w-1.5 h-1.5 rounded-full ${dbOnline ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>}
              <span className={`transition-all duration-300 ease-in-out ${isOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>{dbOnline ? 'Sistem OK' : 'Tidak tersambung'}</span>
            </span>
            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wide ${isProd ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'} transition-all duration-300 ease-in-out ${isOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
              {envLabel}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
