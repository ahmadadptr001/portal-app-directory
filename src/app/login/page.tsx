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
    <div className="min-h-screen relative flex items-center justify-center px-4 overflow-hidden">
      {/* Gedung Kominfo Provinsi Sulawesi Tenggara */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/img/kominfo-building.jpg')" }}
      ></div>
      {/* Scrim sangat tipis — foto tampil transparan & bersih */}
      <div aria-hidden="true" className="absolute inset-0 bg-white/10"></div>

      <div className="relative w-full max-w-sm">
        <form
          onSubmit={handleSubmit}
          className="bg-white/85 backdrop-blur-md border border-white/60 shadow-2xl shadow-slate-900/15 rounded-2xl p-6 space-y-4"
        >
          {/* Logo + nama aplikasi + ringkasan singkat di dalam card */}
          <div className="text-center pb-4 border-b border-slate-200/70">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold mx-auto mb-3 shadow-lg shadow-indigo-500/25">
              <i className="fas fa-cube"></i>
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Portal Direktori App</h1>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
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
    </div>
  );
}
