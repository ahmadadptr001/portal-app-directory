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

export function proxy(request: NextRequest) {
  const session = request.cookies.get('admin_session')
  const isLoginPage = request.nextUrl.pathname === '/login'

  // Belum login & bukan di halaman login -> redirect ke /login
  if (!session && !isLoginPage) {
    return withSecurityHeaders(NextResponse.redirect(new URL('/login', request.url)))
  }

  // Sudah login & di halaman login -> redirect ke /dashboard
  if (session && isLoginPage) {
    return withSecurityHeaders(NextResponse.redirect(new URL('/dashboard', request.url)))
  }

  return withSecurityHeaders(NextResponse.next())
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|img|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest).*)'],
}
