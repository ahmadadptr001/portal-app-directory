import type { Metadata } from 'next';
import { getPublicApps, getPublicCategories, getPublicTechnologies } from '@/lib/public';
import { APP_NAME, REGION_NAME, absoluteUrl } from '@/lib/branding';
import CatalogBrowser, { type CatalogFilters } from '@/components/publik/CatalogBrowser';

/**
 * CATATAN CACHE — halaman ini SENGAJA tidak memakai
 * `export const dynamic = 'force-dynamic'` seperti halaman admin.
 *
 * Halaman ini memang dinamis (membaca `searchParams`), tapi bebannya diserap
 * `unstable_cache` di `getPublicApps()`. Jadi perayap atau scraper yang
 * menghajar /katalog tidak menembus ke database, sementara suntingan admin
 * tetap langsung terlihat lewat `revalidateKatalog()`.
 */

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function readParam(
  params: Record<string, string | string[] | undefined>,
  key: string
): string {
  const raw = params[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' ? value : '';
}

function readFilters(params: Record<string, string | string[] | undefined>): CatalogFilters {
  return {
    q: readParam(params, 'q'),
    kategori: readParam(params, 'kategori') || 'all',
    status: readParam(params, 'status') || 'all',
    teknologi: readParam(params, 'teknologi') || 'all',
  };
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const filters = readFilters(await searchParams);
  const isFiltered =
    filters.q !== '' ||
    filters.kategori !== 'all' ||
    filters.status !== 'all' ||
    filters.teknologi !== 'all';

  const title = `Katalog Aplikasi | ${APP_NAME}`;
  const description = `Jelajahi daftar aplikasi milik ${REGION_NAME}. Cari berdasarkan nama, kategori, status, atau teknologi.`;

  return {
    title,
    description,
    // Varian berfilter tidak diindeks: isinya bagian dari halaman kanonis,
    // jadi mengindeksnya hanya menciptakan duplicate content.
    robots: isFiltered ? { index: false, follow: true } : undefined,
    alternates: { canonical: absoluteUrl('/katalog') },
    openGraph: {
      title,
      description,
      type: 'website',
      locale: 'id_ID',
      url: absoluteUrl('/katalog'),
    },
  };
}

export default async function KatalogPage({ searchParams }: { searchParams: SearchParams }) {
  const filters = readFilters(await searchParams);
  const [apps, categories, technologies] = await Promise.all([
    getPublicApps(),
    getPublicCategories(),
    getPublicTechnologies(),
  ]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <header className="mb-7">
        <p className="text-[10px]/[11px] font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
          Direktori Aplikasi
        </p>
        <h1 className="mt-2 text-2xl sm:text-3xl font-semibold text-slate-800 dark:text-slate-100">
          Katalog Aplikasi
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
          Daftar aplikasi yang dikelola {REGION_NAME}. Klik sebuah aplikasi untuk
          melihat profil lengkapnya.
        </p>
      </header>

      <CatalogBrowser
        apps={apps}
        categories={categories}
        technologies={technologies}
        initial={filters}
      />
    </div>
  );
}
