/**
 * Konstanta & helper peran yang MURNI (tanpa dependensi server).
 *
 * DIPISAH dari `roles.ts` karena berkas itu mengimpor `getSessionAdmin`
 * dari `@/lib/apps` (yang memuat modul Node seperti `fs`) — komponen klien
 * yang hanya butuh label/hierarki peran tidak boleh menyeretnya ke bundel
 * browser. Impor dari sini untuk Client Component; `roles.ts` me-re-export
 * semuanya agar kode server tak perlu berubah.
 */

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
