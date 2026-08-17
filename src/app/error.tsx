"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // Kirim error ke layanan pelaporan error (mis. Sentry) bila ada
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center text-white text-2xl font-bold mx-auto mb-6 shadow-lg shadow-rose-500/20">
          <i className="fas fa-triangle-exclamation"></i>
        </div>
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">
          Terjadi kesalahan
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Terjadi kesalahan yang tidak terduga saat memuat halaman ini.
        </p>
        {error.digest && (
          <p className="mt-3 text-xs text-slate-400 dark:text-slate-500 font-mono">
            Kode error: {error.digest}
          </p>
        )}
        <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
          <button
            onClick={() => retry()}
            className="inline-flex items-center gap-2 bg-blue-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <i className="fas fa-rotate-right"></i> Coba Lagi
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 px-4 py-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
          >
            Kembali ke Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
