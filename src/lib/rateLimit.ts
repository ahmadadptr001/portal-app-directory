/**
 * Rate limiter in-memory untuk endpoint login (sliding window).
 *
 * KENAPA IN-MEMORY: portal ini berjalan single-instance (Laragon/VPS kecil);
 * menambah Redis hanya untuk menghitung percobaan login adalah biaya operas
 * yang tidak sepadan. Konsekuensinya jujur dan terdokumentasi:
 *   - counter hilang saat server restart (penyerang dapat kuota baru);
 *   - tidak berlaku lintas instance bila nanti di-scale-out horizontal.
 * Lapisan pertama tetap assertSameOrigin + bcrypt; ini lapisan ketiga yang
 * membuat brute-force praktis mustahil tanpa infrastruktur tambahan.
 *
 * Kunci identitas memakai HASH IP (bukan IP mentah) + username — konsisten
 * dengan kebijakan privasi UU PDP di requestIdentity.ts.
 */

/** Gagal maksimal per kombinasi username+IP dalam satu jendela. */
const MAX_PER_IDENTITY = 8
/** Gagal maksimal per IP apa pun username-nya (mencegah kamus ke banyak akun). */
const MAX_PER_IP = 30
export const LOGIN_WINDOW_MS = 10 * 60 * 1000 // 10 menit

const buckets = new Map<string, number[]>()

function countFresh(key: string, now: number): number {
  const stamps = buckets.get(key)
  if (!stamps) return 0
  const fresh = stamps.filter((t) => now - t < LOGIN_WINDOW_MS)
  if (fresh.length === 0) buckets.delete(key)
  else buckets.set(key, fresh)
  return fresh.length
}

function mark(key: string, now: number): void {
  const fresh = []
  const existing = buckets.get(key) ?? []
  for (const t of existing) if (now - t < LOGIN_WINDOW_MS) fresh.push(t)
  fresh.push(now)

  // Penjaga memori: serangan dari ribuan kunci palsu tidak boleh membocorkan
  // RAM server. Lewat batas wajar → buang entri kedaluwarsa; kalau masih
  // penuh juga, kosongkan seluruh tabel (penyerang kehilangan progres,
  // pengguna sah nyaris tidak terpengaruh).
  if (buckets.size > 20_000) {
    for (const [k, v] of buckets) {
      if (!v.some((t) => now - t < LOGIN_WINDOW_MS)) buckets.delete(k)
    }
    if (buckets.size > 20_000) buckets.clear()
  }

  buckets.set(key, fresh)
}

function retryAfterSec(key: string, now: number): number {
  const stamps = buckets.get(key) ?? []
  const oldest = Math.min(...stamps)
  return Math.max(1, Math.ceil((oldest + LOGIN_WINDOW_MS - now) / 1000))
}

export interface ThrottleStatus {
  blocked: boolean
  /** Detik sampai boleh mencoba lagi (untuk header Retry-After). */
  retryAfterSec: number
  reason: string | null
}

/** Periksa apakah percobaan login ini harus ditolak dulu. */
export function loginThrottleStatus(ipHash: string | null, username: string): ThrottleStatus {
  const now = Date.now()
  const ipKey = `ip:${ipHash ?? 'unknown'}`
  const idKey = `id:${ipHash ?? 'unknown'}|${username.toLowerCase()}`

  const perIp = countFresh(ipKey, now)
  if (perIp >= MAX_PER_IP) {
    return {
      blocked: true,
      retryAfterSec: retryAfterSec(ipKey, now),
      reason: 'ip',
    }
  }
  const perIdentity = countFresh(idKey, now)
  if (perIdentity >= MAX_PER_IDENTITY) {
    return {
      blocked: true,
      retryAfterSec: retryAfterSec(idKey, now),
      reason: 'identity',
    }
  }
  return { blocked: false, retryAfterSec: 0, reason: null }
}

/** Catat satu kegagalan (password salah / user tak dikenal). */
export function recordLoginFailure(ipHash: string | null, username: string): void {
  const now = Date.now()
  mark(`ip:${ipHash ?? 'unknown'}`, now)
  mark(`id:${ipHash ?? 'unknown'}|${username.toLowerCase()}`, now)
}

/** Login berhasil — bersihkan hitungan gagalnya agar tidak menumpuk. */
export function clearLoginFailures(ipHash: string | null, username: string): void {
  buckets.delete(`id:${ipHash ?? 'unknown'}|${username.toLowerCase()}`)
}
