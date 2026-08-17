import type { NextRequest } from 'next/server'

const MAX_BODY_BYTES = 10 * 1024 * 1024 // 10 MB

function normalizeOrigin(u: string): string {
  return u.replace(/\/+$/, '').toLowerCase()
}

// --- CSRF ---
// SameSite=Lax sudah memblokir pengiriman cookie pada POST lintas-situs di
// browser modern. Cek Origin/Referer ini lapisan kedua: permintaan yang
// mengubah data wajib berasal dari origin aplikasi sendiri. Tanpa ini,
// endpoint seperti POST /api/logout masih bisa dipicu dari situs lain
// (responsnya ikut menghapus cookie korban).
export function assertSameOrigin(request: NextRequest): boolean {
  const expected = normalizeOrigin(
    `${request.nextUrl.protocol}//${request.nextUrl.host}`
  )

  const origin = request.headers.get('origin')
  if (origin) return normalizeOrigin(origin) === expected

  const referer = request.headers.get('referer')
  if (referer) {
    try {
      return normalizeOrigin(new URL(referer).origin) === expected
    } catch {
      return false
    }
  }

  // Tidak ada Origin maupun Referer (mis. klien non-browser). Dari browser,
  // permintaan POST apa pun selalu membawa setidaknya salah satunya.
  return true
}

// --- Batas ukuran body ---
// Mencegah memory DoS lewat payload raksasa sebelum JSON di-parse.
export function isBodyTooLarge(request: NextRequest): boolean {
  const len = request.headers.get('content-length')
  return len !== null && /^\d+$/.test(len) && Number(len) > MAX_BODY_BYTES
}
