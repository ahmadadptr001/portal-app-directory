/**
 * Akun admin, sesi aktif, dan jejak login (migrasi 08).
 *
 * Dipisah dari `apps.ts` yang sudah panjang; polanya sama — `supabaseAdmin`
 * langsung, fungsi baca yang gagal mengembalikan nilai kosong alih-alih
 * melempar, dan pesan galat berbahasa Indonesia.
 */
import { supabaseAdmin } from '@/lib/supabase'
import { isSupabaseConfigured, type Role } from '@/lib/apps'
import { LIMITS, escapeIlike } from '@/lib/validate'

// ---------------------------------------------------------------------------
// Akun admin
// ---------------------------------------------------------------------------

export interface AdminAccount {
  id: number
  username: string
  role: Role
  createdAt: string | null
  /** Jumlah sesi yang masih berlaku — supaya terlihat siapa sedang aktif. */
  activeSessions: number
}

export async function listAdmins(): Promise<AdminAccount[]> {
  if (!isSupabaseConfigured()) return []
  try {
    const { data, error } = await supabaseAdmin
      .from('admins')
      .select('id, username, role, created_at')
      .order('id')
    if (error) throw error

    const { data: sessions } = await supabaseAdmin
      .from('sessions')
      .select('admin_id')
      .gt('expires_at', new Date().toISOString())

    const counts = new Map<number, number>()
    for (const s of sessions ?? []) {
      counts.set(s.admin_id, (counts.get(s.admin_id) ?? 0) + 1)
    }

    return (data ?? []).map((a) => ({
      id: a.id,
      username: a.username,
      role: (a.role ?? 'admin') as Role,
      createdAt: a.created_at ?? null,
      activeSessions: counts.get(a.id) ?? 0,
    }))
  } catch (e) {
    console.error('[admins] Gagal membaca daftar admin:', e)
    return []
  }
}

/** Jumlah superadmin yang tersisa — penjaga agar yang terakhir tidak hilang. */
export async function countSuperadmins(): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('admins')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'superadmin')
  if (error) throw error
  return count ?? 0
}

export async function createAdmin(input: {
  username: string
  passwordHash: string
  role: Role
}): Promise<AdminAccount> {
  const { data, error } = await supabaseAdmin
    .from('admins')
    .insert({
      username: input.username.slice(0, LIMITS.username),
      password_hash: input.passwordHash,
      role: input.role,
    })
    .select('id, username, role, created_at')
    .single()
  if (error) throw error
  return {
    id: data.id,
    username: data.username,
    role: (data.role ?? 'admin') as Role,
    createdAt: data.created_at ?? null,
    activeSessions: 0,
  }
}

export async function updateAdminRole(id: number, role: Role): Promise<void> {
  const { error } = await supabaseAdmin.from('admins').update({ role }).eq('id', id)
  if (error) throw error
}

/** Hapus akun. Sesi & log-nya ikut tertangani lewat FK (CASCADE / SET NULL). */
export async function deleteAdmin(id: number): Promise<void> {
  const { error } = await supabaseAdmin.from('admins').delete().eq('id', id)
  if (error) throw error
}

export async function getAdminById(
  id: number
): Promise<{ id: number; username: string; role: Role } | null> {
  const { data } = await supabaseAdmin
    .from('admins')
    .select('id, username, role')
    .eq('id', id)
    .maybeSingle()
  if (!data) return null
  return { id: data.id, username: data.username, role: (data.role ?? 'admin') as Role }
}

// ---------------------------------------------------------------------------
// Sesi aktif
// ---------------------------------------------------------------------------

export interface ActiveSession {
  id: number
  adminId: number
  username: string
  userAgent: string | null
  ipHash: string | null
  createdAt: string | null
  expiresAt: string
  /** Terakhir dipakai (migrasi 08) — membedakan sesi aktif dari yang menganggur. */
  lastSeenAt: string | null
  /** True untuk sesi yang sedang dipakai peminta — jangan sampai ia mencabut dirinya tanpa sadar. */
  current: boolean
}

export async function listActiveSessions(currentToken?: string): Promise<ActiveSession[]> {
  if (!isSupabaseConfigured()) return []
  try {
    const { data, error } = await supabaseAdmin
      .from('sessions')
      .select('id, admin_id, token, user_agent, ip_hash, created_at, expires_at, last_seen_at, admins(username)')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
    if (error) throw error

    return (data ?? []).map((s) => {
      const row = s as unknown as {
        id: number
        admin_id: number
        token: string
        user_agent: string | null
        ip_hash: string | null
        created_at: string | null
        expires_at: string
        last_seen_at: string | null
        admins?: { username?: string } | null
      }
      return {
        id: row.id,
        adminId: row.admin_id,
        username: row.admins?.username ?? '(akun terhapus)',
        userAgent: row.user_agent ?? null,
        ipHash: row.ip_hash ?? null,
        createdAt: row.created_at ?? null,
        expiresAt: row.expires_at,
        lastSeenAt: row.last_seen_at ?? null,
        current: Boolean(currentToken) && row.token === currentToken,
      }
    })
  } catch (e) {
    console.error('[admins] Gagal membaca sesi aktif:', e)
    return []
  }
}

export async function revokeSession(id: number): Promise<void> {
  const { error } = await supabaseAdmin.from('sessions').delete().eq('id', id)
  if (error) throw error
}

/** Cabut SEMUA sesi milik seorang admin (dipakai saat menurunkan/menghapus peran). */
export async function revokeSessionsOfAdmin(adminId: number): Promise<void> {
  const { error } = await supabaseAdmin.from('sessions').delete().eq('admin_id', adminId)
  if (error) throw error
}

/**
 * Cabut semua sesi lain milik seorang admin KECUALI sesi yang sedang dipakai.
 * Dipakai saat ganti kata sandi: pencuri token lama harus terlempar, tapi
 * pemilik sah tidak boleh ikut ter-log-out dari perangkatnya sendiri.
 */
export async function revokeOtherSessions(
  adminId: number,
  currentToken?: string | null
): Promise<void> {
  let q = supabaseAdmin.from('sessions').delete().eq('admin_id', adminId)
  if (currentToken) q = q.neq('token', currentToken)
  const { error } = await q
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Jejak login
// ---------------------------------------------------------------------------

export type LoginFailReason =
  | 'user_not_found'
  | 'wrong_password'
  | 'invalid_input'
  | 'rate_limited'

export interface LoginLog {
  id: number
  adminId: number | null
  usernameAttempt: string
  success: boolean
  reason: string | null
  ipHash: string | null
  userAgent: string | null
  createdAt: string
}

/**
 * Catat percobaan login — BERHASIL maupun GAGAL.
 *
 * Best-effort: kegagalan pencatatan tidak boleh menggagalkan login itu
 * sendiri (pola yang sama seperti `logActivity`). Yang gagal justru paling
 * berguna: lonjakan kegagalan pada satu username menandakan percobaan
 * masuk paksa.
 */
export async function recordLogin(input: {
  adminId?: number | null
  username: string
  success: boolean
  reason?: LoginFailReason | null
  ipHash?: string | null
  userAgent?: string | null
}): Promise<void> {
  try {
    await supabaseAdmin.from('login_logs').insert({
      admin_id: input.adminId ?? null,
      username_attempt: String(input.username ?? '').slice(0, LIMITS.username),
      success: input.success,
      reason: input.reason ?? null,
      ip_hash: input.ipHash ?? null,
      user_agent: input.userAgent ?? null,
    })
  } catch (e) {
    console.error('[admins] Gagal mencatat jejak login:', e)
  }
}

export interface LoginLogQuery {
  success?: 'true' | 'false'
  search?: string
  limit?: number
  offset?: number
}

export async function getLoginLogs(
  query: LoginLogQuery = {}
): Promise<{ logs: LoginLog[]; total: number; failed24h: number }> {
  if (!isSupabaseConfigured()) return { logs: [], total: 0, failed24h: 0 }

  try {
    const limit = Math.min(Math.max(Number(query.limit) || 25, 1), 100)
    const offset = Math.max(Number(query.offset) || 0, 0)

    let q = supabaseAdmin.from('login_logs').select('*', { count: 'exact' })
    if (query.success === 'true') q = q.eq('success', true)
    if (query.success === 'false') q = q.eq('success', false)
    if (query.search) q = q.ilike('username_attempt', `%${escapeIlike(query.search)}%`)

    const { data, count, error } = await q
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    if (error) throw error

    // Kegagalan 24 jam terakhir — angka yang paling layak dipantau.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count: failed } = await supabaseAdmin
      .from('login_logs')
      .select('*', { count: 'exact', head: true })
      .eq('success', false)
      .gte('created_at', since)

    const logs: LoginLog[] = (data ?? []).map((r) => ({
      id: r.id,
      adminId: r.admin_id ?? null,
      usernameAttempt: r.username_attempt,
      success: Boolean(r.success),
      reason: r.reason ?? null,
      ipHash: r.ip_hash ?? null,
      userAgent: r.user_agent ?? null,
      createdAt: r.created_at,
    }))

    return { logs, total: count ?? logs.length, failed24h: failed ?? 0 }
  } catch (e) {
    console.error('[admins] Gagal membaca jejak login:', e)
    return { logs: [], total: 0, failed24h: 0 }
  }
}
