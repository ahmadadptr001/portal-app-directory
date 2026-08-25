/* Kartu aplikasi untuk permukaan publik.
 *
 * Server Component (tidak ada state/handler) — cukup dirender di server,
 * jadi isinya ikut terbaca crawler. Anatominya mengikuti kartu admin di
 * AppsPage: tile inisial, judul, kategori, titik status, deskripsi 2 baris,
 * tech dipisah ' · '. Bedanya: TIDAK ada progress/env/server/database, dan
 * logo aplikasi dipakai bila tersedia.
 */
import Link from 'next/link';
import type { PublicApp } from '@/types';
import { STATUS_DOT, getInitials, statusLabel } from '@/lib/appMeta';

export default function PublicAppCard({ app }: { app: PublicApp }) {
  return (
    <article className="group relative bg-white dark:bg-slate-800 rounded-xl border border-slate-200/70 dark:border-slate-700/60 overflow-hidden transition-all duration-200 hover:border-blue-300 dark:hover:border-blue-700/60 hover:shadow-md hover:shadow-slate-200/60 dark:hover:shadow-black/20 motion-reduce:transition-none flex flex-col">
      <Link href={`/katalog/${app.slug}`} className="flex-1 p-5 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 shrink-0 rounded-lg bg-slate-100 dark:bg-slate-700/50 border border-slate-200/60 dark:border-slate-600/50 flex items-center justify-center overflow-hidden text-slate-500 dark:text-slate-300 text-sm font-semibold transition-colors group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 group-hover:text-blue-600 dark:group-hover:text-blue-400">
              {app.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- URL remote dari admin: host sembarang, tidak bisa didaftarkan di images.remotePatterns tanpa membuka image optimizer sebagai proxy fetch
                <img
                  src={app.logoUrl}
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  className="w-full h-full object-contain"
                />
              ) : (
                getInitials(app.name)
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">
                {app.name}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{app.category}</p>
            </div>
          </div>
          <span className="flex items-center gap-1.5 shrink-0 text-xs text-slate-500 dark:text-slate-400">
            <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[app.status] ?? 'bg-slate-400'}`}></span>
            {statusLabel(app.status)}
          </span>
        </div>

        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
          {app.description || 'Belum ada deskripsi.'}
        </p>

        {app.tech.length > 0 && (
          <p className="mt-4 text-xs text-slate-400 dark:text-slate-500 truncate" title={app.tech.join(' · ')}>
            {app.tech.join(' · ')}
          </p>
        )}
      </Link>

      <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-3 text-xs">
        <span className="text-slate-400 dark:text-slate-500 truncate">
          {app.owner ?? 'Unit kerja belum ditentukan'}
        </span>
        {app.url ? (
          <a
            href={app.url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-1.5 font-medium text-blue-600 dark:text-blue-400 hover:underline outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
          >
            Buka
            <i className="fas fa-arrow-up-right-from-square text-[9px]"></i>
          </a>
        ) : (
          <span className="shrink-0 text-slate-300 dark:text-slate-600">Tanpa tautan</span>
        )}
      </div>
    </article>
  );
}
