import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Portal Direktori Aplikasi v2',
    short_name: 'Portal Apps',
    description:
      'Portal Direktori Aplikasi v2 — Kelola dan jelajahi daftar aplikasi dengan mudah.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#2563eb',
    lang: 'id',
    icons: [
      {
        src: '/icon.png',
        sizes: '32x32',
        type: 'image/png',
      },
    ],
  }
}
