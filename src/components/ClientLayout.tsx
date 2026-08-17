"use client";

import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { usePathname } from 'next/navigation';

export default function ClientLayout({ children, appCount, appEnv }: { children: React.ReactNode; appCount: number; appEnv: string }) {
  // Sidebar default TERBUKA LEBAR di desktop; effect di bawah menutupnya otomatis di layar kecil (<768px).
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDark, setIsDark] = useState(false);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const toggleTheme = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    localStorage.setItem('app_dark_mode', String(newDark));
    document.documentElement.classList.toggle('dark', newDark);
  };

  const pathname = usePathname();

  useEffect(() => {
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false); // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, [pathname]);

  useEffect(() => {
    const savedDark = localStorage.getItem('app_dark_mode') === 'true';
    setIsDark(savedDark); // eslint-disable-line react-hooks/set-state-in-effect
    document.documentElement.classList.toggle('dark', savedDark);
    const handleThemeChange = () => {
      const newDark = localStorage.getItem('app_dark_mode') === 'true';
      document.documentElement.classList.toggle('dark', newDark);
      setIsDark(newDark);
    };
    window.addEventListener('themeChange', handleThemeChange);
    if (isDark) document.documentElement.classList.add('dark');
    return () => window.removeEventListener('themeChange', handleThemeChange);
  }, []);
  const activePage = pathname.split('/')[1] || 'dashboard';

  const pageTitleMap: Record<string, string> = {
    dashboard: 'Dashboard',
    apps: 'Daftar Aplikasi',
    categories: 'Kategori',
    technologies: 'Teknologi',
    logs: 'Log Aktivitas',
    settings: 'Pengaturan'
  };
  const pageTitle = pageTitleMap[activePage] || 'Dashboard';

  // Halaman tanpa chrome sidebar/topbar: login, help, dan URL tak dikenal (404)
  const isAppPage = ['/dashboard', '/apps', '/categories', '/technologies', '/logs', '/settings'].includes(pathname);
  if (!isAppPage) {
    return (
      // Pakai variant `dark:` (keyed ke class .dark di <html>, di-set inline
      // script layout.tsx sebelum paint) — bukan state isDark — supaya latar
      // sudah benar pada frame pertama tanpa flash terang.
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        {children}
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar
        activePage={activePage}
        isOpen={isSidebarOpen}
        toggle={toggleSidebar}
        appCount={appCount}
        appEnv={appEnv}
      />

      {isSidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={toggleSidebar}></div>
      )}

      <main className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${isSidebarOpen ? 'md:ml-64' : 'md:ml-20'}`}>
        <Topbar title={pageTitle} toggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} isDark={isDark} toggleTheme={toggleTheme} />
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
