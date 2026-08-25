import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Portal Direktori Aplikasi — Provinsi Sulawesi Tenggara',
    short_name: 'Direktori Sultra',
    description:
      'Portal Direktori Aplikasi Pemerintah Provinsi Sulawesi Tenggara — kelola dan jelajahi daftar aplikasi daerah dengan mudah.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8fafc',
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
