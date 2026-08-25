import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/branding'
import { getPublicApps } from '@/lib/public'

/**
 * Sitemap: halaman publik + satu entri per aplikasi yang dipublikasikan.
 *
 * Rute admin TIDAK dimasukkan (semuanya di balik login), dan `/login` juga
 * dibuang — halaman masuk tidak punya alasan berada di sitemap.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const apps = await getPublicApps()

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${SITE_URL}/katalog`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/help`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ]

  const appRoutes: MetadataRoute.Sitemap = apps.map((app) => ({
    url: `${SITE_URL}/katalog/${app.slug}`,
    // Pakai waktu perubahan aplikasi yang sebenarnya, bukan `new Date()` —
    // lastModified yang selalu "sekarang" tidak memberi informasi apa pun
    // kepada mesin pencari.
    lastModified: app.updatedAt ? new Date(app.updatedAt) : new Date(),
    changeFrequency: 'weekly',
    priority: 0.7,
  }))

  return [...staticRoutes, ...appRoutes]
}
