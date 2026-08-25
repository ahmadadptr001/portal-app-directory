import type { MetadataRoute } from 'next'
import { APP_NAME, GOV_NAME, REGION_NAME } from '@/lib/branding'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_NAME} — ${REGION_NAME}`,
    short_name: 'Direktori Sultra',
    description: `${APP_NAME} ${GOV_NAME} — jelajahi daftar aplikasi daerah dengan mudah.`,
    // `/` kini beranda portal publik (dulu redirect ke /dashboard), jadi PWA
    // yang dipasang warga membuka katalog, bukan layar login.
    start_url: '/',
    display: 'standalone',
    background_color: '#f8fafc',
    // #2563eb = blue-600, aksen resmi portal (lihat scripts/gen_static_images.py
    // yang memakai warna yang sama untuk ikon & kartu OG).
    theme_color: '#2563eb',
    lang: 'id',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  }
}
