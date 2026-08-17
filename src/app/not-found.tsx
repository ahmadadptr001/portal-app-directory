import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '404 — Aplikasi tidak ditemukan',
}

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="text-center max-w-lg w-full">
        {/* Grid mini kartu aplikasi — satu slot kosong (yang dicari) */}
        <div className="mx-auto w-56 mb-8">
          <div className="grid grid-cols-3 gap-3">
            <div className="h-14 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700"></div>
            <div className="h-14 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700"></div>
            <div className="h-14 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700"></div>
            <div className="h-14 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700"></div>
            <div className="h-14 rounded-lg border-2 border-dashed border-blue-400/60 dark:border-blue-500/40 bg-blue-50/50 dark:bg-blue-500/5 flex items-center justify-center">
              <i className="fas fa-question text-blue-500 dark:text-blue-400 text-lg"></i>
            </div>
            <div className="h-14 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700"></div>
          </div>
        </div>

        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xl font-bold mx-auto mb-5 shadow-lg shadow-blue-500/20">
          <i className="fas fa-cube"></i>
        </div>

        <p className="text-5xl font-extrabold tracking-tight text-blue-600 dark:text-blue-400">
          404
        </p>
        <h1 className="mt-2 text-xl font-bold text-slate-800 dark:text-slate-100">
          Aplikasi tidak ditemukan
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Aplikasi yang Anda cari tidak ada di direktori kami — mungkin sudah
          dipindahkan, dihapus, atau belum terdaftar.
        </p>

        <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 bg-blue-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors shadow-sm shadow-blue-500/20"
          >
            <i className="fas fa-arrow-left"></i> Kembali ke Dashboard
          </Link>
          <Link
            href="/apps"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          >
            Lihat Daftar Aplikasi
          </Link>
        </div>
      </div>
    </div>
  )
}
