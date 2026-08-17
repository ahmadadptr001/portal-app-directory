import { cache } from 'react'
import type { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { App, AppEnv, AppStatus } from '@/types'
import { APP_DATA } from '@/data/initialData'
import { LIMITS, VALID_ENV, VALID_STATUS } from '@/lib/validate'

// --- Konstanta & helper keamanan ---
const SESSION_COOKIE = 'admin_session'
const SESSION_DAYS = 7

function randomToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

// Hanya izinkan URL http(s); nilai lain (mis. javascript:) dianggap tidak ada
// sehingga tidak bisa disisipkan sebagai link berbahaya.
function sanitizeUrl(url: unknown): string | null {
  if (url == null || url === '#') return null
  const s = String(url).trim()
  if (!/^https?:\/\//i.test(s)) return null
  try {
    return new URL(s).href
  } catch {
    return null
  }
}

function sanitizeStatus(value: unknown): AppStatus {
  return (VALID_STATUS as readonly string[]).includes(String(value))
    ? (String(value) as AppStatus)
    : 'active'
}

function sanitizeEnv(value: unknown): AppEnv {
  return (VALID_ENV as readonly string[]).includes(String(value))
    ? (String(value) as AppEnv)
    : 'development'
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// ---------------------------------------------------------------------------
// Pemetaan baris DB -> tipe App (id, kategori sebagai string, tech array)
// ---------------------------------------------------------------------------

interface DbAppRow {
  id: number
  name: string
  category_id: number | null
  status: AppStatus
  env: AppEnv
  url: string | null
  owner: string | null
  version: string | null
  progress: number
  description: string | null
  server: string | null
  database: string | null
  created_at?: string | null
  categories?: { name: string } | null
}

function mapDbRow(row: DbAppRow, tech: string[]): App {
  return {
    id: row.id,
    name: row.name,
    category: row.categories?.name ?? 'Uncategorized',
    status: row.status,
    env: row.env,
    url: row.url ?? '#',
    owner: row.owner ?? '-',
    version: row.version ?? '1.0.0',
    progress: row.progress ?? 0,
    description: row.description ?? '',
    tech,
    server: row.server ?? '-',
    database: row.database ?? '-',
    createdAt: row.created_at ?? undefined,
  }
}

// cache() = dedupe pemanggilan dalam satu request render
// (layout + page yang sama tidak query DB dua kali).
export const getAllApps = cache(async (): Promise<App[]> => {
  if (!isSupabaseConfigured()) return APP_DATA

  try {
    const { data: rows, error } = await supabaseAdmin
      .from('apps')
      .select('*, categories(name)')
      .order('id', { ascending: true })

    if (error) throw error
    if (!rows || rows.length === 0) return []

    // Ambil SEMUA relasi tech lalu kelompokkan di JS. Tidak memakai `.in()`
    // karena dengan ribuan app, daftar id bisa melebihi batas panjang query
    // PostgREST (414 / gagal) — ini aman untuk data dalam jumlah besar.
    const { data: techRows } = await supabaseAdmin
      .from('app_tech')
      .select('app_id, tech')

    const techMap: Record<number, string[]> = {}
    for (const t of techRows ?? []) {
      ;(techMap[t.app_id] ??= []).push(t.tech)
    }

    return rows.map((r) => mapDbRow(r, techMap[r.id] ?? []))
  } catch (e) {
    console.error('[apps] Gagal membaca DB, fallback ke APP_DATA:', e)
    return APP_DATA
  }
})

export const getAllCategories = cache(async (): Promise<string[]> => {
  const fallback = () => Array.from(new Set(APP_DATA.map((a) => a.category)))

  if (!isSupabaseConfigured()) return fallback()

  try {
    const { data, error } = await supabaseAdmin
      .from('categories')
      .select('name')
      .order('name')

    if (error) throw error
    return (data ?? []).map((c) => c.name)
  } catch (e) {
    console.error('[apps] Gagal membaca kategori dari DB:', e)
    return fallback()
  }
})

// Daftar teknologi = semua nama unik yang dipakai di relasi app_tech
// (tanpa tabel registri terpisah — tech baru otomatis muncul begitu
// dipakai oleh sebuah aplikasi).
export const getAllTechnologies = cache(async (): Promise<string[]> => {
  const fallback = () =>
    Array.from(new Set(APP_DATA.flatMap((a) => a.tech))).sort((a, b) => a.localeCompare(b))

  if (!isSupabaseConfigured()) return fallback()

  try {
    const { data, error } = await supabaseAdmin.from('app_tech').select('tech')
    if (error) throw error
    return Array.from(new Set((data ?? []).map((t) => t.tech))).sort((a, b) => a.localeCompare(b))
  } catch (e) {
    console.error('[apps] Gagal membaca teknologi dari DB:', e)
    return fallback()
  }
})

export type NewAppInput = Omit<App, 'id'>

// Cari id kategori berdasarkan nama; buat otomatis bila belum ada.
async function resolveCategoryId(catName: string | undefined): Promise<number | null> {
  const name = catName?.trim().slice(0, LIMITS.category)
  if (!name || name === 'Uncategorized') return null

  const { data: existing } = await supabaseAdmin
    .from('categories')
    .select('id')
    .eq('name', name)
    .maybeSingle()
  if (existing) return existing.id

  const { data: created, error } = await supabaseAdmin
    .from('categories')
    .insert({ name })
    .select('id')
    .single()
  if (error || !created) return null
  return created.id
}

// Buat aplikasi baru (kategori dibuat otomatis bila belum ada).
// Melempar Error('DATABASE_NOT_CONFIGURED') bila Supabase tidak terkonfigurasi.
export async function createApp(input: NewAppInput): Promise<App> {
  if (!isSupabaseConfigured()) {
    throw new Error('DATABASE_NOT_CONFIGURED')
  }

  const categoryId = await resolveCategoryId(input.category)

  const { data: row, error } = await supabaseAdmin
    .from('apps')
    .insert({
      name: String(input.name).slice(0, LIMITS.appName),
      category_id: categoryId,
      status: sanitizeStatus(input.status),
      env: sanitizeEnv(input.env),
      url: sanitizeUrl(input.url),
      owner: String(input.owner ?? '').slice(0, LIMITS.owner) || null,
      version: String(input.version ?? '1.0.0').slice(0, LIMITS.version),
      progress: Math.min(100, Math.max(0, Number(input.progress) || 0)),
      description: String(input.description ?? '').slice(0, LIMITS.description),
      server: String(input.server ?? '').slice(0, LIMITS.server) || null,
      database: String(input.database ?? '').slice(0, LIMITS.database) || null,
    })
    .select('*, categories(name)')
    .single()

  if (error) throw error

  const tech = (input.tech ?? []).filter(Boolean)
  if (tech.length > 0) {
    const { error: techErr } = await supabaseAdmin
      .from('app_tech')
      .insert(tech.map((t) => ({ app_id: row.id, tech: t })))
    if (techErr) throw techErr
  }

  return mapDbRow(row, tech)
}

// Perbarui aplikasi yang sudah ada: update baris apps + ganti seluruh app_tech.
export async function updateApp(id: number, input: NewAppInput): Promise<App> {
  if (!isSupabaseConfigured()) {
    throw new Error('DATABASE_NOT_CONFIGURED')
  }

  const categoryId = await resolveCategoryId(input.category)

  const { data: row, error } = await supabaseAdmin
    .from('apps')
    .update({
      name: String(input.name).slice(0, LIMITS.appName),
      category_id: categoryId,
      status: sanitizeStatus(input.status),
      env: sanitizeEnv(input.env),
      url: sanitizeUrl(input.url),
      owner: String(input.owner ?? '').slice(0, LIMITS.owner) || null,
      version: String(input.version ?? '1.0.0').slice(0, LIMITS.version),
      progress: Math.min(100, Math.max(0, Number(input.progress) || 0)),
      description: String(input.description ?? '').slice(0, LIMITS.description),
      server: String(input.server ?? '').slice(0, LIMITS.server) || null,
      database: String(input.database ?? '').slice(0, LIMITS.database) || null,
    })
    .eq('id', id)
    .select('*, categories(name)')
    .single()

  if (error) {
    // PGRST116 = baris tidak ditemukan
    if (error.code === 'PGRST116') throw new Error('APP_NOT_FOUND')
    throw error
  }

  // Ganti seluruh relasi tech (cara paling sederhana & konsisten).
  const tech = (input.tech ?? []).filter(Boolean)
  const { error: delErr } = await supabaseAdmin
    .from('app_tech')
    .delete()
    .eq('app_id', id)
  if (delErr) throw delErr

  if (tech.length > 0) {
    const { error: techErr } = await supabaseAdmin
      .from('app_tech')
      .insert(tech.map((t) => ({ app_id: id, tech: t })))
    if (techErr) throw techErr
  }

  return mapDbRow(row, tech)
}

export async function deleteApp(id: number): Promise<void> {
  const { error } = await supabaseAdmin.from('apps').delete().eq('id', id)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Kategori
// ---------------------------------------------------------------------------

// Buat kategori baru. Melempar bila nama duplikat (unique constraint).
export async function createCategory(name: string): Promise<{ id: number; name: string }> {
  const { data, error } = await supabaseAdmin
    .from('categories')
    .insert({ name })
    .select('id, name')
    .single()
  if (error) throw error
  return data
}

// Ganti nama kategori. App yang memakainya otomatis ikut berubah
// karena relasi memakai category_id (join categories(name)).
export async function updateCategory(name: string, newName: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('categories')
    .update({ name: newName })
    .eq('name', name)
  if (error) throw error
}

// Hapus kategori; app di dalamnya menjadi 'Uncategorized'
// (foreign key ON DELETE SET NULL).
export async function deleteCategory(name: string): Promise<void> {
  const { error } = await supabaseAdmin.from('categories').delete().eq('name', name)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Teknologi (langsung pada relasi app_tech — tanpa tabel registri)
// ---------------------------------------------------------------------------

// Ganti nama teknologi: perbarui SEMUA relasi app_tech yang memakainya.
export async function updateTechnology(name: string, newName: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('app_tech')
    .update({ tech: newName })
    .eq('tech', name)
  if (error) throw error
}

// Hapus teknologi: hilangkan dari SEMUA aplikasi yang memakainya.
export async function deleteTechnology(name: string): Promise<void> {
  const { error } = await supabaseAdmin.from('app_tech').delete().eq('tech', name)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Sesi login (tabel `sessions`)
// ---------------------------------------------------------------------------
// Cookie `admin_session` hanya memuat token acak 256-bit; token disimpan di
// tabel `sessions` bersama admin_id & expires_at, dan DIVALIDASI ke DB pada
// setiap permintaan. Format lama `base64(id:timestamp)` TIDAK diterima lagi
// karena bisa dipalsukan tanpa kata sandi (token tanpa tanda tangan).

// Buat sesi baru untuk admin. Menghapus sesi admin yang sudah kedaluwarsa.
export async function createSession(adminId: number): Promise<string> {
  const token = randomToken()
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString()

  await supabaseAdmin
    .from('sessions')
    .delete()
    .eq('admin_id', adminId)
    .lte('expires_at', new Date().toISOString())

  const { error } = await supabaseAdmin.from('sessions').insert({
    admin_id: adminId,
    token,
    expires_at: expiresAt,
  })
  if (error) throw error
  return token
}

// Validasi token sesi ke database; kembalikan info admin (id + username) atau null.
// Dipakai untuk otorisasi sekaligus pencatatan log aktivitas (siapa yang bertindak).
export async function getSessionAdmin(
  request: NextRequest
): Promise<{ id: number; username: string } | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value
  // Format lama `base64(id:...)` berisi titik dua — tolak (dapat dipalsukan).
  if (!token || token.includes(':')) return null

  const { data } = await supabaseAdmin
    .from('sessions')
    .select('admin_id, admins(username)')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (!data) {
    // Token tidak dikenal / sudah kedaluwarsa — bersihkan agar tidak menumpuk.
    await supabaseAdmin.from('sessions').delete().eq('token', token)
    return null
  }
  return {
    id: data.admin_id,
    username: (data as { admins?: { username?: string } | null }).admins?.username ?? 'admin',
  }
}

// Validasi token sesi ke database; kembalikan admin id atau null.
export async function getSessionAdminId(request: NextRequest): Promise<number | null> {
  const admin = await getSessionAdmin(request)
  return admin?.id ?? null
}

// ---------------------------------------------------------------------------
// Log aktivitas (audit trail tabel `activity_logs`)
// ---------------------------------------------------------------------------

export type ActivityAction = 'create' | 'update' | 'delete' | 'import' | 'reset'
export type ActivityEntity = 'app' | 'category' | 'technology' | 'system'

export interface ActivityLog {
  id: number
  adminUsername: string
  action: ActivityAction
  entityType: ActivityEntity
  entityName: string
  entityId: number | null
  details: string | null
  createdAt: string
}

// Catat aktivitas admin (best-effort — kegagalan logging tidak boleh
// menggagalkan operasi utama).
export async function logActivity(input: {
  adminId: number
  username: string
  action: ActivityAction
  entityType: ActivityEntity
  entityName: string
  entityId?: number | null
  details?: string | null
}): Promise<void> {
  try {
    await supabaseAdmin.from('activity_logs').insert({
      admin_id: input.adminId,
      admin_username: String(input.username).slice(0, LIMITS.username),
      action: input.action,
      entity_type: input.entityType,
      entity_name: String(input.entityName).slice(0, LIMITS.logEntity),
      entity_id: input.entityId ?? null,
      details: input.details ? String(input.details).slice(0, LIMITS.logDetail) : null,
    })
  } catch (e) {
    console.error('[apps] Gagal mencatat aktivitas:', e)
  }
}

export interface ActivityLogQuery {
  action?: string
  entityType?: string
  search?: string
  limit?: number
  offset?: number
}

// Baca log aktivitas terbaru (urutan terbalik). Mendukung filter aksi,
// jenis entitas, dan pencarian nama; total = jumlah baris setelah filter.
export async function getActivityLogs(
  query: ActivityLogQuery = {}
): Promise<{ logs: ActivityLog[]; total: number }> {
  if (!isSupabaseConfigured()) return { logs: [], total: 0 }

  try {
    const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 100)
    const offset = Math.max(Number(query.offset) || 0, 0)

    const base = supabaseAdmin.from('activity_logs').select('*', { count: 'exact' })
    let filtered = base
    if (query.action) filtered = filtered.eq('action', query.action)
    if (query.entityType) filtered = filtered.eq('entity_type', query.entityType)
    if (query.search) filtered = filtered.ilike('entity_name', `%${query.search}%`)

    const { data, count, error } = await filtered
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    if (error) throw error

    const logs: ActivityLog[] = (data ?? []).map((r) => ({
      id: r.id,
      adminUsername: r.admin_username,
      action: r.action as ActivityAction,
      entityType: r.entity_type as ActivityEntity,
      entityName: r.entity_name,
      entityId: r.entity_id ?? null,
      details: r.details ?? null,
      createdAt: r.created_at,
    }))
    return { logs, total: count ?? logs.length }
  } catch (e) {
    console.error('[apps] Gagal membaca log aktivitas:', e)
    return { logs: [], total: 0 }
  }
}

// Hapus sesi aktif (dipakai saat logout).
export async function destroySession(request: NextRequest): Promise<void> {
  const token = request.cookies.get(SESSION_COOKIE)?.value
  if (!token || token.includes(':')) return
  await supabaseAdmin.from('sessions').delete().eq('token', token)
}

export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    path: '/',
  })
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.delete(SESSION_COOKIE)
}
