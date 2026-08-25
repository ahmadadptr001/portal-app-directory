/**
 * Identitas brand Portal Direktori Aplikasi Provinsi Sulawesi Tenggara.
 * Satu sumber untuk nama aplikasi & nama daerah supaya semua permukaan
 * branding (metadata, Open Graph, ikon) konsisten.
 */

export const APP_NAME = "Portal Direktori Aplikasi";
export const REGION_NAME = "Provinsi Sulawesi Tenggara";
export const GOV_NAME = "Pemerintah Provinsi Sulawesi Tenggara";
export const AGENCY_NAME = "Dinas Komunikasi dan Informatika";

/**
 * Alamat kanonis portal — dipakai `metadataBase`, sitemap, robots, dan
 * URL Open Graph.
 *
 * Sebelumnya nilai ini diketik ulang di tiga tempat (`layout.tsx`,
 * `sitemap.ts`, `robots.ts`). Dijadikan satu di sini, dan bisa ditimpa lewat
 * env supaya deployment ke domain pemda (atau Laragon) tidak menghasilkan
 * sitemap yang menunjuk ke *.vercel.app.
 *
 * Catatan: dibaca dari NEXT_PUBLIC_* agar nilainya sama di server & klien.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://portal-app-directory.vercel.app"
).replace(/\/+$/, "");

/** URL absolut untuk sebuah path relatif (mis. untuk Open Graph & sitemap). */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
