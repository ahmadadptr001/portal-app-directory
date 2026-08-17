import Link from 'next/link'

export default function Unauthorized() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white text-2xl font-bold mx-auto mb-6 shadow-lg shadow-blue-500/20">
          <i className="fas fa-lock"></i>
        </div>
        <p className="text-6xl font-extrabold tracking-tight bg-gradient-to-r from-sky-600 to-blue-600 bg-clip-text text-transparent dark:from-sky-400 dark:to-blue-400">
          401
        </p>
        <h1 className="mt-3 text-xl font-bold text-slate-800 dark:text-slate-100">
          Tidak terautentikasi
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Anda harus masuk terlebih dahulu untuk mengakses halaman ini.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex items-center gap-2 bg-blue-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <i className="fas fa-right-to-bracket"></i> Masuk
        </Link>
      </div>
    </div>
  )
}
