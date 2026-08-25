import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getPublicAppById, getPublicAppBySlug } from '@/lib/public';
import { getPublicChangelogs } from '@/lib/changelogs';
import { APP_NAME, GOV_NAME, REGION_NAME, absoluteUrl } from '@/lib/branding';
import { STATUS_DOT, getInitials, statusLabel } from '@/lib/appMeta';
import ScreenshotGallery from '@/components/publik/ScreenshotGallery';
import type { ChangelogKind } from '@/types';

const CHANGELOG_KIND: Record<ChangelogKind, { label: string; chip: string }> = {
  feature: { label: 'Fitur', chip: 'bg-emerald-100 text-emerald-700' },
  fix: { label: 'Perbaikan', chip: 'bg-amber-100 text-amber-700' },
  security: { label: 'Keamanan', chip: 'bg-red-100 text-red-700' },
  other: { label: 'Lainnya', chip: 'bg-slate-100 text-slate-600' },
};

/**
 * ISR per-slug.
 *
 * SENGAJA TANPA `generateStaticParams`: `next build` bisa berjalan tanpa env
 * Supabase (mis. di CI), dan generateStaticParams akan memanggang daftar slug
 * dari keadaan itu — menghasilkan halaman kosong atau slug yang salah.
 * Membiarkan tiap slug dibangun saat pertama diminta lalu di-cache jauh lebih
 * tahan terhadap perbedaan lingkungan.
 */
export const revalidate = 300;

type Params = Promise<{ slug: string }>;

const isNumeric = (s: string) => /^\d+$/.test(s);

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  // Tanggal ditulis eksplisit dalam bahasa Indonesia, bukan toLocaleDateString
  // dengan locale runtime — server & klien harus menghasilkan teks yang sama
  // persis, kalau tidak hidrasi akan mismatch (lihat CLAUDE.md:28).
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const BULAN = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];
  const month = BULAN[Number(m[2]) - 1];
  if (!month) return null;
  return `${Number(m[3])} ${month} ${m[1]}`;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const app = await getPublicAppBySlug(slug);
  if (!app) return { title: `Aplikasi tidak ditemukan | ${APP_NAME}` };

  const title = `${app.name} | ${APP_NAME}`;
  const description =
    app.description?.slice(0, 200) ||
    `${app.name} — aplikasi ${app.category} milik ${REGION_NAME}.`;
  const url = absoluteUrl(`/katalog/${app.slug}`);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: app.name,
      description,
      type: 'website',
      locale: 'id_ID',
      url,
      siteName: APP_NAME,
      // Memakai kartu OG STATIS milik portal (src/app/opengraph-image.png,
      // dibuat oleh scripts/gen_static_images.py dengan PIL).
      //
      // Kartu OG per-aplikasi lewat `next/og` (ImageResponse) SUDAH DICOBA dan
      // GAGAL di environment ini: rute-nya membalas 500 dan dev server mencatat
      // "Jest worker encountered child process exceptions" — renderer satori/
      // resvg-nya crash. Itu sebab yang sama yang membuat ikon & kartu OG di
      // proyek ini dibuat statis sejak awal (lihat komentar di
      // scripts/gen_static_images.py). Jangan ganti balik ke ImageResponse
      // tanpa memverifikasi rutenya benar-benar mengembalikan PNG.
      images: ['/opengraph-image.png'],
    },
  };
}

export default async function AppDetailPage({ params }: { params: Params }) {
  const { slug } = await params;

  // Tautan lama berbasis id (mis. /katalog/12) dialihkan ke URL slug kanonis
  // supaya tidak ada dua alamat untuk satu halaman.
  if (isNumeric(slug)) {
    const byId = await getPublicAppById(Number(slug));
    if (byId) redirect(`/katalog/${byId.slug}`);
    notFound();
  }

  const app = await getPublicAppBySlug(slug);
  if (!app) notFound();

  const goLive = formatDate(app.goLiveDate);

  // Hanya entri ber-flag publik yang pernah keluar dari sini — catatan
  // internal admin tersimpan di DB tapi tidak pernah sampai ke halaman ini
  // (saringannya di query `getPublicChangelogs`, bukan di JSX).
  const changelogs = await getPublicChangelogs(app.id);

  // JSON-LD supaya mesin pencari memahami halaman ini sebagai aplikasi,
  // bukan artikel biasa.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: app.name,
        applicationCategory: app.category,
        description: app.description || undefined,
        url: app.url || undefined,
        softwareVersion: app.version || undefined,
        image: app.logoUrl || undefined,
        datePublished: app.goLiveDate || undefined,
        publisher: { '@type': 'GovernmentOrganization', name: GOV_NAME },
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'IDR' },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Beranda', item: absoluteUrl('/') },
          { '@type': 'ListItem', position: 2, name: 'Katalog', item: absoluteUrl('/katalog') },
          {
            '@type': 'ListItem',
            position: 3,
            name: app.name,
            item: absoluteUrl(`/katalog/${app.slug}`),
          },
        ],
      },
    ],
  };

  const metaItem = (label: string, value: React.ReactNode) => (
    <div>
      <dt className="text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</dt>
      <dd className="text-sm font-medium text-slate-800 dark:text-slate-200">{value}</dd>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-6 text-xs text-slate-500 dark:text-slate-400">
        <ol className="flex items-center gap-2 flex-wrap">
          <li>
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              Beranda
            </Link>
          </li>
          <li aria-hidden="true" className="text-slate-300 dark:text-slate-600">/</li>
          <li>
            <Link href="/katalog" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              Katalog
            </Link>
          </li>
          <li aria-hidden="true" className="text-slate-300 dark:text-slate-600">/</li>
          <li className="text-slate-700 dark:text-slate-300 font-medium truncate max-w-[50vw]">
            {app.name}
          </li>
        </ol>
      </nav>

      {/* Kepala halaman */}
      <header className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/70 dark:border-slate-700/60 p-6 sm:p-7">
        <div className="flex flex-col sm:flex-row sm:items-start gap-5">
          <div className="w-16 h-16 shrink-0 rounded-xl bg-slate-100 dark:bg-slate-700/50 border border-slate-200/60 dark:border-slate-600/50 flex items-center justify-center overflow-hidden text-slate-500 dark:text-slate-300 text-lg font-semibold">
            {app.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- URL remote dari admin: host sembarang, tidak bisa didaftarkan di images.remotePatterns
              <img
                src={app.logoUrl}
                alt=""
                aria-hidden="true"
                className="w-full h-full object-contain"
              />
            ) : (
              getInitials(app.name)
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[app.status] ?? 'bg-slate-400'}`}></span>
                {statusLabel(app.status)}
              </span>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
              <Link
                href={`/katalog?kategori=${encodeURIComponent(app.category)}`}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                {app.category}
              </Link>
            </div>
            <h1 className="mt-1.5 text-2xl font-semibold text-slate-800 dark:text-slate-100">
              {app.name}
            </h1>
            {app.description && (
              <p className="mt-2.5 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {app.description}
              </p>
            )}

            {app.url ? (
              <a
                href={app.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 h-10 inline-flex items-center gap-2 bg-blue-600 text-white px-4 rounded-lg hover:bg-blue-700 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-slate-900 transition-colors"
              >
                <i className="fas fa-arrow-up-right-from-square text-xs"></i>
                Buka Aplikasi
              </a>
            ) : (
              <p className="mt-5 inline-flex items-center gap-2 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs text-slate-400 dark:text-slate-500">
                <i className="fas fa-link-slash text-[10px]"></i>
                Tautan aplikasi belum tersedia
              </p>
            )}
          </div>
        </div>
      </header>

      {/* Informasi */}
      <div className="mt-5 grid gap-5 md:grid-cols-3">
        <div className="md:col-span-2 space-y-5">
          {app.screenshots.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/70 dark:border-slate-700/60 p-6">
              <ScreenshotGallery screenshots={app.screenshots} />
            </div>
          )}

          {app.tech.length > 0 && (
            <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/70 dark:border-slate-700/60 p-6">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
                Teknologi
              </h2>
              <div className="flex flex-wrap gap-2">
                {app.tech.map((t) => (
                  <Link
                    key={t}
                    href={`/katalog?teknologi=${encodeURIComponent(t)}`}
                    className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1 rounded-full text-xs hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    {t}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {changelogs.length > 0 && (
            <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/70 dark:border-slate-700/60 p-6">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">
                Riwayat Versi
              </h2>
              <ol className="relative space-y-5 border-l border-slate-200 dark:border-slate-700 pl-5">
                {changelogs.map((entry) => {
                  const kind = CHANGELOG_KIND[entry.kind];
                  return (
                    <li key={entry.id} className="relative">
                      <span
                        aria-hidden="true"
                        className="absolute -left-[26.5px] top-1 w-2 h-2 rounded-full bg-blue-500 ring-4 ring-white dark:ring-slate-800"
                      ></span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                          v{entry.version}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${kind.chip}`}>
                          {kind.label}
                        </span>
                        <time
                          dateTime={entry.releasedAt ?? undefined}
                          className="ml-auto text-xs text-slate-400 dark:text-slate-500"
                        >
                          {formatDate(entry.releasedAt) ?? '—'}
                        </time>
                      </div>
                      {entry.notes && (
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
                          {entry.notes}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          )}
        </div>

        <aside className="space-y-5">
          <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/70 dark:border-slate-700/60 p-6">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">
              Informasi
            </h2>
            <dl className="space-y-3.5">
              {metaItem('Unit Kerja / OPD', app.owner ?? '—')}
              {metaItem('Versi', app.version ?? '—')}
              {metaItem('Mulai Beroperasi', goLive ?? '—')}
            </dl>
          </section>

          {(app.contactName || app.contactEmail || app.contactPhone) && (
            <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/70 dark:border-slate-700/60 p-6">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">
                Kontak Pengelola
              </h2>
              <dl className="space-y-3.5">
                {app.contactName && metaItem('Penanggung Jawab', app.contactName)}
                {app.contactEmail &&
                  metaItem(
                    'Email',
                    <a
                      href={`mailto:${app.contactEmail}`}
                      className="text-blue-600 dark:text-blue-400 hover:underline break-all"
                    >
                      {app.contactEmail}
                    </a>
                  )}
                {app.contactPhone &&
                  metaItem(
                    'Telepon',
                    <a
                      href={`tel:${app.contactPhone.replace(/\s+/g, '')}`}
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {app.contactPhone}
                    </a>
                  )}
              </dl>
            </section>
          )}
        </aside>
      </div>

      <div className="mt-8">
        <Link
          href="/katalog"
          className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          <i className="fas fa-arrow-left text-xs"></i>
          Kembali ke katalog
        </Link>
      </div>
    </div>
  );
}
