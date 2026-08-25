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

      {/* Panel login — sidebar fixed kiri menempel pada tepi layar.
          Responsif: penuh di layar kecil, lebar tetap di layar besar.
          Sudut kiri atas & kiri bawah dibuat melengkung sedikit. */}
      <aside className="fixed left-0 top-0 z-10 flex h-full w-full sm:w-[420px] lg:w-[460px] flex-col justify-center overflow-y-auto bg-white/85 backdrop-blur-md border-r border-white/60 shadow-2xl shadow-slate-900/20 rounded-tl-[20px] rounded-bl-[20px]">
        <div className="px-6 py-10 sm:px-10">
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
