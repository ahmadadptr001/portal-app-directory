/* Footer portal publik. Server Component — tidak butuh interaktivitas.
 *
 * Teks tahun memakai `suppressHydrationWarning`, pola yang sama seperti
 * footer admin di ClientLayout.tsx:88 (lihat aturan hidrasi di CLAUDE.md).
 */
import Link from 'next/link';
import { AGENCY_NAME, APP_NAME, GOV_NAME, REGION_NAME } from '@/lib/branding';

export default function PublicFooter() {
  return (
    <footer className="mt-16 border-t border-slate-200/70 dark:border-slate-800/70 bg-white/60 dark:bg-slate-900/60">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-8">
          <div className="max-w-sm">
            <div className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element -- aset SVG lokal kecil, konsisten dengan header & sidebar */}
              <img
                src="/img/logo-sultra.svg"
                alt=""
                aria-hidden="true"
                className="w-8 h-8 object-contain"
              />
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{APP_NAME}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{REGION_NAME}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Direktori resmi aplikasi milik {GOV_NAME}. Dikelola oleh {AGENCY_NAME}.
            </p>
          </div>

          <nav aria-label="Tautan footer" className="flex flex-col gap-2 text-xs">
            <p className="font-semibold text-slate-700 dark:text-slate-200 mb-0.5">Jelajahi</p>
            <Link href="/katalog" className="text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              Katalog Aplikasi
            </Link>
            <Link href="/help" className="text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              Bantuan
            </Link>
          </nav>
        </div>

        <div className="mt-8 pt-5 border-t border-slate-200/70 dark:border-slate-800/70 text-[11px] text-slate-400 dark:text-slate-500 text-center">
          © <span suppressHydrationWarning>{new Date().getFullYear()}</span> {AGENCY_NAME} — {REGION_NAME}
        </div>
      </div>
    </footer>
  );
}
