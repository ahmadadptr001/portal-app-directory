import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Header keamanan HTTP dasar untuk semua halaman (API menangani CSRF
// sendiri lewat cek Origin/Referer di src/lib/security.ts).
const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
}

function withSecurityHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value)
  }
  return response
}

/**
 * Rute yang boleh dibuka TANPA login.
 *
 * Dulu gate ini "tolak semua kecuali /login". Sejak portal punya katalog
 * publik, polanya dibalik menjadi daftar-izin: yang tidak ada di sini tetap
 * dilempar ke /login. Membalik arah default seperti ini penting — menambah
 * halaman admin baru otomatis ikut terlindungi tanpa perlu diingat.
 */
const PUBLIC_EXACT = new Set(['/', '/login', '/help'])

/**
 * Rute publik berikut seluruh isinya.
 *
 * Pencocokan HARUS berbasis prefiks, bukan kecocokan persis:
 *   /katalog                          → daftar aplikasi
 *   /katalog/<slug>                   → halaman detail
 *   /katalog/<slug>/opengraph-image   → kartu OG untuk tautan yang dibagikan
 * Rute gambar OG yang bersarang itu tidak dikecualikan oleh `config.matcher`
 * di bawah (di sana hanya ada `opengraph-image.png` di root), jadi tanpa
 * pencocokan prefiks crawler WhatsApp/X akan menerima redirect ke /login
 * dan tautan yang dibagikan tampil tanpa kartu.
 */
const PUBLIC_PREFIXES = ['/katalog']

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

export function proxy(request: NextRequest) {
  const session = request.cookies.get('admin_session')
  const { pathname } = request.nextUrl
  const isLoginPage = pathname === '/login'

  // Sudah login & di halaman login -> redirect ke /dashboard.
  // SENGAJA hanya untuk /login: admin yang sedang login harus tetap bisa
  // membuka beranda & katalog publik untuk memeriksa hasil terbitannya.
  if (session && isLoginPage) {
    return withSecurityHeaders(NextResponse.redirect(new URL('/dashboard', request.url)))
  }

  // Halaman publik: selalu boleh, dengan atau tanpa sesi.
  if (isPublicPath(pathname)) {
    return withSecurityHeaders(NextResponse.next())
  }

  // Sisanya (dashboard, apps, categories, technologies, logs, settings, dan
  // apa pun yang ditambahkan nanti) wajib punya sesi.
  //
  // Catatan: cookie di sini hanya diperiksa ADA/TIDAK — ini pemeriksaan
  // optimistis supaya gate tetap murah. Keabsahan token divalidasi ke
  // database oleh `getSessionAdmin` di setiap route API. Jadi cookie palsu
  // bisa melewati gate ini, tapi tidak bisa membaca atau mengubah data.
  if (!session) {
    const loginUrl = new URL('/login', request.url)
    return withSecurityHeaders(NextResponse.redirect(loginUrl))
  }

  return withSecurityHeaders(NextResponse.next())
}

export const config = {
  // Rute metadata ikon (favicon.ico, icon.png, opengraph-image.png) dikecualikan
  // agar favicon & kartu OG tetap bisa diakses crawler/pengunjung yang belum login.
  //
  // ⚠️ SETIAP FOLDER ASET DI `public/` WAJIB ADA DI DAFTAR PENGECUALIAN INI.
  // Kalau tidak, berkasnya ikut melewati gate, tidak ada di daftar rute publik,
  // lalu dijawab 307 redirect ke /login — dan gejalanya membingungkan: aset
  // "tidak muncul" tanpa error apa pun di konsol. Itu persis yang terjadi pada
  // `video/` saat pertama ditambahkan. Folder yang sudah didaftarkan: `img`,
  // `video`.
  matcher: ['/((?!api|_next/static|_next/image|img|video|favicon.ico|icon.png$|opengraph-image.png$|robots.txt|sitemap.xml|manifest.webmanifest).*)'],
}
