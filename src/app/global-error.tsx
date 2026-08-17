"use client";

import { useEffect } from "react";
import "./globals.css";

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="id" className="h-full antialiased">
      <body
        className="ge-body min-h-screen flex items-center justify-center px-4"
        style={{
          fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <div className="ge-card text-center max-w-md w-full bg-white border border-slate-200 rounded-2xl shadow-xl p-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center text-white text-2xl font-bold mx-auto mb-6 shadow-lg shadow-rose-500/20">
            !
          </div>
          <h1 className="ge-text text-xl font-bold text-slate-800">
            Terjadi kesalahan fatal
          </h1>
          <p className="ge-sub mt-2 text-sm text-slate-500">
            Terjadi kesalahan yang tidak terduga. Silakan coba lagi.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
            <button
              onClick={() => retry()}
              className="inline-flex items-center gap-2 bg-blue-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Coba Lagi
            </button>
            <button
              onClick={() => (window.location.href = "/login")}
              className="ge-text inline-flex items-center gap-2 text-sm font-medium text-slate-600 px-4 py-2.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Kembali ke Login
            </button>
          </div>
        </div>
        <style>{`
          @media (prefers-color-scheme: dark) {
            .ge-body { background: #020617; }
            .ge-card { background: #1e293b; border-color: #334155; }
            .ge-text { color: #f1f5f9; }
            .ge-sub { color: #94a3b8; }
          }
        `}</style>
      </body>
    </html>
  );
}
