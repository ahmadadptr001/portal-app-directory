"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Gagal masuk');
      } else {
        router.push('/dashboard');
        router.refresh();
      }
    } catch {
      setError('Tidak dapat terhubung ke server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Gedung Kominfo Provinsi Sulawesi Tenggara */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/img/kominfo-building.jpg')" }}
      ></div>
      {/* Scrim sangat tipis — foto tampil transparan & bersih */}
      <div aria-hidden="true" className="absolute inset-0 bg-white/10"></div>

      {/* Panel login — sidebar fixed kanan menempel pada tepi layar (desktop),
          bottom sheet di layar kecil (mobile). Responsif mengikuti ukuran layar:
          - Mobile: menempel di bawah, sudut kiri-atas & kanan-atas melengkung.
          - Desktop: menempel di kanan, sudut kiri-atas & kiri-bawah melengkung. */}
      <aside className="fixed inset-x-0 bottom-0 z-10 flex max-h-[92vh] flex-col justify-center overflow-y-auto rounded-tl-[20px] rounded-tr-[20px] border-t border-white/60 bg-white/85 shadow-2xl shadow-slate-900/20 backdrop-blur-md sm:inset-x-auto sm:bottom-0 sm:right-0 sm:top-0 sm:h-full sm:max-h-none sm:w-[420px] sm:rounded-bl-[20px] sm:rounded-br-none sm:rounded-tr-none sm:border-l sm:border-t-0 lg:w-[460px]">
        <div className="px-6 pb-10 pt-8 sm:px-10 sm:py-10">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Lambang + nama aplikasi + ringkasan singkat */}
            <div className="text-center pb-5 border-b border-slate-200/70">
              {/* Lambang Provinsi Sulawesi Tenggara (aset: public/img/logo-sultra.svg) */}
              <img
                src="/img/logo-sultra.svg"
                alt="Lambang Provinsi Sulawesi Tenggara"
                className="w-16 h-16 object-contain mx-auto mb-3 drop-shadow-sm"
              />
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Portal Direktori Aplikasi</h1>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700 mt-1.5">
                Provinsi Sulawesi Tenggara
              </p>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Kelola direktori aplikasi di lingkungan Kominfo Provinsi Sulawesi Tenggara.
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-sm text-red-600">
                <i className="fas fa-circle-exclamation"></i>
                <span>{error}</span>
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-slate-700 mb-1.5 block">Username</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Nama pengguna" className="w-full bg-white/70 backdrop-blur-sm border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all" autoFocus />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700 mb-1.5 block">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full bg-white/70 backdrop-blur-sm border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all" />
            </div>
            <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white font-medium text-sm py-2.5 rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg shadow-indigo-600/25">
              {loading ? <><i className="fas fa-spinner fa-spin"></i> Memproses...</> : <><i className="fas fa-right-to-bracket"></i> Masuk</>}
            </button>
          </form>
        </div>
      </aside>
    </div>
  );
}
