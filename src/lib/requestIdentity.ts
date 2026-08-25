/**
 * Identitas permintaan: hash alamat IP + user agent.
 *
 * KENAPA HASH, BUKAN IP MENTAH:
 * Alamat IP adalah data pribadi menurut UU PDP No. 27/2022. Untuk keperluan
 * portal ini — mengenali "sesi ini dari tempat yang berbeda" dan "ada lonjakan
 * percobaan login" — hash sudah cukup; identitas aslinya tidak perlu disimpan.
 *
 * Garam (salt) dibaca dari env `IP_HASH_SALT`. Tanpa garam, hash IPv4 bisa
 * dibalik dengan mudah: ruangnya hanya 4 miliar, satu tabel pelangi selesai
 * dalam hitungan menit. Bila env tidak diisi, dipakai garam cadangan yang
 * diturunkan dari service-role key supaya TETAP ada garam rahasia — tapi
 * sebaiknya diisi eksplisit di produksi.
 */
import { createHash } from 'crypto'
import type { NextRequest } from 'next/server'

const SALT =
  process.env.IP_HASH_SALT ||
  process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 32) ||
  'portal-direktori-fallback-salt'

/**
 * Ambil IP klien dari header proxy.
 *
 * Catatan: header ini bisa dipalsukan bila aplikasi tidak berada di belakang
 * proxy yang menulisnya ulang. Untuk pemakaiannya di sini (jejak & petunjuk
 * lokasi sesi) itu dapat diterima — nilainya informatif, bukan dasar
 * keputusan keamanan.
 */
function clientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    // Format: "klien, proxy1, proxy2" — yang pertama adalah klien.
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  return request.headers.get('x-real-ip') || null
}

/** Hash IP klien (hex 64 karakter) atau null bila IP tidak diketahui. */
export function hashClientIp(request: NextRequest): string | null {
  const ip = clientIp(request)
  if (!ip) return null
  return createHash('sha256').update(`${SALT}:${ip}`).digest('hex')
}

/** User agent, dipotong agar tidak membengkak. */
export function clientUserAgent(request: NextRequest): string | null {
  const ua = request.headers.get('user-agent')
  return ua ? ua.slice(0, 400) : null
}
