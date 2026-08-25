/**
 * Peran admin & penegakannya.
 *
 * ATURAN EMAS: peran WAJIB ditegakkan di SERVER, di setiap route mutasi.
 * Menyembunyikan tombol di UI bukan penegakan — siapa pun bisa memanggil
 * API langsung dengan curl. Karena itu setiap route yang mengubah data
 * memanggil `requireRole` sebelum menyentuh database.
 */
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getSessionAdmin, type SessionAdmin } from '@/lib/apps'

export type Role = 'superadmin' | 'admin' | 'viewer'

export const VALID_ROLES = ['superadmin', 'admin', 'viewer'] as const

/** Label peran untuk antarmuka. */
export const ROLE_LABEL: Record<Role, string> = {
  superadmin: 'Superadmin',
  admin: 'Admin',
  viewer: 'Peninjau',
}

export const ROLE_DESCRIPTION: Record<Role, string> = {
  superadmin: 'Kelola akun & peran, cabut sesi, reset data.',
  admin: 'Kelola aplikasi, kategori, teknologi, dan changelog.',
  viewer: 'Hanya melihat — tidak dapat mengubah apa pun.',
}

/**
 * Urutan wewenang. Peran dengan angka lebih besar mencakup wewenang
 * peran di bawahnya.
 */
const RANK: Record<Role, number> = {
  viewer: 0,
  admin: 1,
  superadmin: 2,
}

export function sanitizeRole(value: unknown): Role {
  const s = String(value ?? '')
  return (VALID_ROLES as readonly string[]).includes(s) ? (s as Role) : 'viewer'
}

/** True bila `role` setara atau lebih tinggi dari `minimum`. */
export function hasRole(role: Role, minimum: Role): boolean {
  return RANK[role] >= RANK[minimum]
}

export type RoleGateResult =
  | { ok: true; admin: SessionAdmin }
  | { ok: false; response: NextResponse }

/**
 * Gerbang peran untuk route handler.
 *
 * Pakai seperti guard yang sudah ada di proyek ini:
 *
 *   const gate = await requireRole(request, 'admin')
 *   if (!gate.ok) return gate.response
 *   // gate.admin.id / .username / .role siap dipakai
 *
 * 401 bila tidak ada sesi sah, 403 bila perannya tidak cukup — dibedakan
 * supaya klien bisa membedakan "belum masuk" dari "tidak berwenang".
 */
export async function requireRole(
  request: NextRequest,
  minimum: Role
): Promise<RoleGateResult> {
  const admin = await getSessionAdmin(request)
  if (!admin) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }
  if (!hasRole(admin.role, minimum)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: `Akses ditolak: butuh peran ${ROLE_LABEL[minimum]} atau lebih tinggi`,
        },
        { status: 403 }
      ),
    }
  }
  return { ok: true, admin }
}
