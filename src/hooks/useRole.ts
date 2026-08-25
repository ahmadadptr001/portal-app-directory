'use client'

/**
 * Peran admin yang sedang login — untuk MENYEMBUNYIKAN tombol yang pasti
 * ditolak server (`requireRole`).
 *
 * BUKAN pengaman: penegakan tetap di route API. Nilai ini hanya kenyamanan
 * agar pengguna peran `viewer` tidak melihat deretan tombol yang semuanya
 * akan membalas 403.
 *
 * Cache di level modul (60 detik) supaya puluhan komponen bisa memakai hook
 * ini tanpa membanjiri `/api/profile`; Topbar/Sidebar pun sudah mem-fetch
 * endpoint yang sama secara berkala.
 */
import { useEffect, useState } from 'react'
import type { Role } from '@/lib/rolesShared'

const CACHE_TTL_MS = 60_000

let cache: { role: Role; at: number } | null = null
let inflight: Promise<Role> | null = null

function normalizeRole(value: unknown): Role {
  return value === 'superadmin' || value === 'admin' || value === 'viewer'
    ? value
    : // Gagal fetch / jawaban tak dikenal diperlakukan paling konservatif:
      // anggap viewer (tombol tersembunyi) — server tetap menolak bila salah.
      'viewer'
}

function requestRole(): Promise<Role> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return Promise.resolve(cache.role)
  if (!inflight) {
    inflight = fetch('/api/profile')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const role = normalizeRole(data?.role)
        cache = { role, at: Date.now() }
        return role
      })
      .catch(() => 'viewer' as Role)
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

/** Paksa segarkan (mis. setelah ganti peran/ganti password). */
export function refreshRole(): void {
  cache = null
}

/**
 * `null` = peran belum diketahui (fetch berjalan). Pemanggil disarankan
 * menampilkan UI netral sampai nilai tiba, bukan menganggapnya viewer.
 */
export function useRole(): Role | null {
  const [role, setRole] = useState<Role | null>(cache ? cache.role : null)

  useEffect(() => {
    let alive = true
    requestRole().then((r) => {
      if (alive) setRole(r)
    })
    return () => {
      alive = false
    }
  }, [])

  return role
}
