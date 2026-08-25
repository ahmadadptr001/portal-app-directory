import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/branding'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/katalog'],
      // Tanpa garis miring penutup — SENGAJA.
      // `'/dashboard/'` hanya memblokir path DI BAWAH /dashboard/, sementara
      // /dashboard sendiri tetap boleh dirayapi. Bentuk tanpa garis miring
      // menutup keduanya.
      disallow: [
        '/api',
        '/dashboard',
        '/apps',
        '/categories',
        '/technologies',
        '/logs',
        '/settings',
        '/login',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
