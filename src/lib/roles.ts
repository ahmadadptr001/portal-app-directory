/**
 * Peran admin & penegakannya di SERVER.
 *
 * ATURAN EMAS: peran WAJIB ditegakkan di SERVER, di setiap route mutasi.
 * Menyembunyikan tombol di UI bukan penegakan — siapa pun bisa memanggil
 * API langsung dengan curl. Karena itu setiap route yang mengubah data
 * memanggil `requireRole` sebelum menyentuh database.
 *
 * Definisi tipe/konstanta ada di `rolesShared.ts` (murni, aman untuk bundel
 * klien); berkas ini tinggal penegakannya. Re-export menjaga semua jalur
 * impor lama tetap bekerja di kode server.
 */
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getSessionAdmin, type SessionAdmin } from '@/lib/apps'
import {
  hasRole,
  ROLE_LABEL,
  type Role,
} from '@/lib/rolesShared'

export * from '@/lib/rolesShared'

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
