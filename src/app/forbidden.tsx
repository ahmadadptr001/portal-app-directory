import Link from 'next/link'

export default function Forbidden() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-2xl font-bold mx-auto mb-6 shadow-lg shadow-amber-500/20">
          <i className="fas fa-shield-halved"></i>
        </div>
        <p className="text-6xl font-extrabold tracking-tight bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent dark:from-amber-400 dark:to-orange-400">
          403
        </p>
        <h1 className="mt-3 text-xl font-bold text-slate-800 dark:text-slate-100">
          Akses ditolak
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Anda tidak memiliki izin untuk mengakses halaman ini.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex items-center gap-2 bg-blue-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <i className="fas fa-arrow-left"></i> Kembali ke Dashboard
        </Link>
      </div>
    </div>
  )
}
