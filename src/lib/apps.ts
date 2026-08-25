import { cache } from 'react'
import type { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { App, AppEnv, AppStatus, Screenshot } from '@/types'
import { APP_DATA } from '@/data/initialData'
import { LIMITS, VALID_ENV, VALID_STATUS, escapeIlike } from '@/lib/validate'
import { buildUniqueSlug } from '@/lib/slug'

/** Peran admin. Definisi lengkap + penegakannya ada di `src/lib/roles.ts`;
 *  tipe-nya diulang di sini agar tidak terjadi impor melingkar
 *  (roles.ts mengimpor getSessionAdmin dari berkas ini). */
export type Role = 'superadmin' | 'admin' | 'viewer'

// --- Konstanta & helper keamanan ---
// Diekspor karena Server Component tidak punya `NextRequest`: halaman seperti
// `/users` membacanya lewat `cookies()` dari `next/headers`.
export const SESSION_COOKIE = 'admin_session'
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
  slug?: string | null
  category_id: number | null
  status: AppStatus
  env: AppEnv
  is_public?: boolean | null
  url: string | null
  owner: string | null
  version: string | null
  progress: number
  description: string | null
  server: string | null
  database: string | null
  logo_url?: string | null
  go_live_date?: string | null
  contact_name?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  created_at?: string | null
  updated_at?: string | null
  categories?: { name: string } | null
}

function mapDbRow(row: DbAppRow, tech: string[], screenshots: Screenshot[] = []): App {
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
    // --- Field katalog publik (migrasi 07) ---
    // Dibiarkan undefined bila kolomnya belum ada (database yang belum
    // menjalankan migrasi 07), supaya halaman admin tetap berjalan.
    slug: row.slug ?? undefined,
    isPublic: row.is_public ?? false,
    logoUrl: row.logo_url ?? null,
    goLiveDate: row.go_live_date ?? null,
    contactName: row.contact_name ?? null,
    contactEmail: row.contact_email ?? null,
    contactPhone: row.contact_phone ?? null,
    screenshots,
  }
}

/**
 * Ambil seluruh screenshot lalu kelompokkan per app_id.
 *
 * Sama seperti relasi tech: dibaca sekali untuk SEMUA aplikasi, bukan
 * per-aplikasi dengan `.in()`, supaya panjang query tidak meledak saat
 * jumlah aplikasi besar.
 *
 * Tabel `app_screenshots` baru ada setelah migrasi 07. Bila belum ada,
 * Supabase mengembalikan error dan fungsi ini mengembalikan map kosong —
 * halaman admin tetap jalan, screenshot-nya saja yang belum tampil.
 */
async function getScreenshotMap(): Promise<Record<number, Screenshot[]>> {
  const map: Record<number, Screenshot[]> = {}
  try {
    const { data, error } = await supabaseAdmin
      .from('app_screenshots')
      .select('app_id, url, caption, sort_order')
      .order('sort_order', { ascending: true })
    if (error) throw error
    for (const s of data ?? []) {
      ;(map[s.app_id] ??= []).push({ url: s.url, caption: s.caption ?? null })
    }
  } catch (e) {
    console.error('[apps] Gagal membaca screenshot (migrasi 07 sudah jalan?):', e)
  }
  return map
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

    const shotMap = await getScreenshotMap()

    return rows.map((r) => mapDbRow(r, techMap[r.id] ?? [], shotMap[r.id] ?? []))
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

/** Jumlah aplikasi — query ringan (COUNT saja, tanpa menarik baris).
 *
 * Dipakai root layout untuk badge sidebar. Sebelumnya layout memanggil
 * `getAllApps()` hanya untuk `apps.length`, yang berarti satu pembacaan
 * tabel penuh + SELURUH relasi tech pada SETIAP request — termasuk
 * kunjungan publik ke beranda/katalog. */
export const getAppCount = cache(async (): Promise<number> => {
  if (!isSupabaseConfigured()) return APP_DATA.length

  try {
    const { count, error } = await supabaseAdmin
      .from('apps')
      .select('*', { count: 'exact', head: true })
    if (error) throw error
    return count ?? 0
  } catch (e) {
    console.error('[apps] Gagal menghitung jumlah aplikasi:', e)
    return 0
  }
})

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

/**
 * Tentukan slug untuk aplikasi.
 *
 * - `desired` (slug yang diisi admin) dipakai bila ada, setelah dirapikan.
 * - Bila kosong, dibuat dari nama aplikasi.
 * - Dijamin unik terhadap slug yang sudah ada (kecuali milik `excludeId`
 *   sendiri, supaya menyimpan ulang aplikasi yang sama tidak menambah
 *   imbuhan angka setiap kali).
 */
async function resolveSlug(
  name: string,
  desired: string | undefined | null,
  excludeId?: number
): Promise<string> {
  const { data } = await supabaseAdmin.from('apps').select('id, slug')
  const taken = (data ?? [])
    .filter((r) => r.slug && r.id !== excludeId)
    .map((r) => r.slug as string)

  const wanted = String(desired ?? '').trim()
  if (wanted) {
    // Slug pilihan admin tetap dirapikan supaya tidak ada spasi/huruf besar
    // yang membuat URL tidak konsisten.
    const clean = buildUniqueSlug(wanted, taken)
    return clean
  }
  return buildUniqueSlug(name, taken)
}

/**
 * Kolom "profil publik" yang dikirim ke DB.
 *
 * URL logo dilewatkan `sanitizeUrl` — inilah yang menahan `javascript:` dan
 * skema lain masuk lalu ter-render sebagai atribut src/href.
 */
function publicProfileColumns(input: NewAppInput) {
  return {
    is_public: Boolean(input.isPublic),
    logo_url: sanitizeUrl(input.logoUrl),
    go_live_date: normalizeDate(input.goLiveDate),
    contact_name: cleanOrNull(input.contactName, LIMITS.contactName),
    contact_email: cleanOrNull(input.contactEmail, LIMITS.contactEmail),
    contact_phone: cleanOrNull(input.contactPhone, LIMITS.contactPhone),
  }
}

function cleanOrNull(value: unknown, max: number): string | null {
  const s = String(value ?? '').trim().slice(0, max)
  return s || null
}

/** Terima hanya YYYY-MM-DD; nilai lain dianggap tidak ada. */
function normalizeDate(value: unknown): string | null {
  const s = String(value ?? '').trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

/**
 * Tulis ulang seluruh screenshot milik sebuah aplikasi.
 *
 * Pola hapus-semua-lalu-tulis-ulang, sama seperti relasi `app_tech`:
 * paling sederhana dan tidak meninggalkan baris yatim.
 */
async function replaceScreenshots(appId: number, screenshots: Screenshot[] | undefined) {
  const rows = (screenshots ?? [])
    .map((s, i) => {
      const url = sanitizeUrl(s?.url)
      if (!url) return null
      return {
        app_id: appId,
        url,
        caption: cleanOrNull(s?.caption, LIMITS.caption),
        sort_order: i,
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .slice(0, LIMITS.maxScreenshots)

  const { error: delErr } = await supabaseAdmin
    .from('app_screenshots')
    .delete()
    .eq('app_id', appId)
  if (delErr) throw delErr

  if (rows.length > 0) {
    const { error } = await supabaseAdmin.from('app_screenshots').insert(rows)
    if (error) throw error
  }
}

// Buat aplikasi baru (kategori dibuat otomatis bila belum ada).
// Melempar Error('DATABASE_NOT_CONFIGURED') bila Supabase tidak terkonfigurasi.
export async function createApp(input: NewAppInput): Promise<App> {
  if (!isSupabaseConfigured()) {
    throw new Error('DATABASE_NOT_CONFIGURED')
  }

  const categoryId = await resolveCategoryId(input.category)
  const name = String(input.name).slice(0, LIMITS.appName)
  const slug = await resolveSlug(name, input.slug)

  const { data: row, error } = await supabaseAdmin
    .from('apps')
    .insert({
      name,
      slug,
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
      ...publicProfileColumns(input),
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

  await replaceScreenshots(row.id, input.screenshots)

  return mapDbRow(row, tech, input.screenshots ?? [])
}

// Perbarui aplikasi yang sudah ada: update baris apps + ganti seluruh app_tech.
export async function updateApp(id: number, input: NewAppInput): Promise<App> {
  if (!isSupabaseConfigured()) {
    throw new Error('DATABASE_NOT_CONFIGURED')
  }

  const categoryId = await resolveCategoryId(input.category)
  const name = String(input.name).slice(0, LIMITS.appName)

  // Slug SENGAJA tidak dibuat ulang dari nama saat aplikasi disunting:
  // tautan yang sudah tersebar (materi sosialisasi, QR, pesan WhatsApp)
  // tidak boleh mati hanya karena nama aplikasi dirapikan. Slug hanya
  // berubah bila admin mengisinya sendiri di form.
  const { data: existing } = await supabaseAdmin
    .from('apps')
    .select('slug')
    .eq('id', id)
    .maybeSingle()
  const currentSlug = (existing as { slug?: string | null } | null)?.slug ?? null

  const desired = String(input.slug ?? '').trim()
  const slug =
    desired && desired !== currentSlug
      ? await resolveSlug(name, desired, id)
      : currentSlug ?? (await resolveSlug(name, null, id))

  const { data: row, error } = await supabaseAdmin
    .from('apps')
    .update({
      name,
      slug,
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
      ...publicProfileColumns(input),
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

  await replaceScreenshots(id, input.screenshots)

  return mapDbRow(row, tech, input.screenshots ?? [])
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
// `meta` (user agent + hash IP) dipakai halaman "Sesi Aktif" supaya admin
// bisa mengenali dan mencabut sesi dari perangkat yang tidak dikenal.
export async function createSession(
  adminId: number,
  meta?: { userAgent?: string | null; ipHash?: string | null }
): Promise<string> {
  const token = randomToken()
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString()

  await supabaseAdmin
    .from('sessions')
    .delete()
    .eq('admin_id', adminId)
    .lte('expires_at', new Date().toISOString())

  const row: Record<string, unknown> = {
    admin_id: adminId,
    token,
    expires_at: expiresAt,
  }
  // Kolom metadata baru ada setelah migrasi 08. Disisipkan hanya bila
  // nilainya ada, dan kegagalannya ditangani di bawah supaya login tetap
  // berhasil pada database yang belum dimigrasi.
  if (meta?.userAgent) row.user_agent = meta.userAgent
  if (meta?.ipHash) row.ip_hash = meta.ipHash

  const { error } = await supabaseAdmin.from('sessions').insert(row)
  if (error) {
    // Kemungkinan kolom metadata belum ada (migrasi 08 belum dijalankan).
    // Login tidak boleh gagal hanya karena itu — coba lagi tanpa metadata.
    console.error('[apps] Insert sesi dengan metadata gagal, coba tanpa metadata:', error)
    const { error: retryErr } = await supabaseAdmin.from('sessions').insert({
      admin_id: adminId,
      token,
      expires_at: expiresAt,
    })
    if (retryErr) throw retryErr
  }
  return token
}

export interface SessionAdmin {
  id: number
  username: string
  role: Role
}

// Validasi token sesi ke database; kembalikan info admin (id + username + peran).
// Dipakai untuk otorisasi sekaligus pencatatan log aktivitas (siapa yang bertindak).
export async function getSessionAdmin(
  request: NextRequest
): Promise<SessionAdmin | null> {
  return getSessionAdminByToken(request.cookies.get(SESSION_COOKIE)?.value)
}

/**
 * Perbarui `sessions.last_seen_at` (migrasi 08) — penanda "terakhir terlihat"
 * yang dipakai halaman Sesi Aktif untuk mengenali sesi menganggur vs aktif.
 *
 * Ditulis paling sering SEKALI PER MENIT per sesi: fungsi ini berjalan di
 * SETIAP permintaan terautentikasi, dan menulis di tiap permintaan berarti
 * beban UPDATE sia-sia plus baris sesi jadi kontensi. Throttle memakai nilai
 * last_seen_at yang sudah ikut terbaca pada query validasi (tanpa query
 * tambahan untuk memutuskan).
 */
async function touchLastSeen(
  token: string,
  lastSeenAt: string | null | undefined
): Promise<void> {
  const freshEnough =
    !!lastSeenAt &&
    Date.now() - new Date(lastSeenAt).getTime() < 60_000 &&
    !Number.isNaN(new Date(lastSeenAt).getTime())
  if (freshEnough) return
  try {
    await supabaseAdmin
      .from('sessions')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('token', token)
  } catch {
    // Best-effort — kegagalan penanda tidak boleh menggagalkan permintaan.
  }
}

/**
 * Versi `getSessionAdmin` yang menerima token mentah.
 *
 * Route handler punya `NextRequest`, tetapi Server Component TIDAK — halaman
 * `/users` perlu tahu peran pembukanya untuk merender bagian yang benar, dan
 * satu-satunya jalan ke cookie di sana adalah `cookies()` dari `next/headers`.
 * Logikanya tidak digandakan: `getSessionAdmin` hanya membungkus fungsi ini.
 */
export async function getSessionAdminByToken(
  token: string | undefined | null
): Promise<SessionAdmin | null> {
  // Format lama `base64(id:...)` berisi titik dua — tolak (dapat dipalsukan).
  if (!token || token.includes(':')) return null

  // Kolom `admins.role` baru ada setelah migrasi 08. Bila belum ada, query
  // ini GAGAL — dan dulu kegagalannya diperlakukan sebagai "token tidak
  // dikenal", sehingga sesi yang sah ikut DIHAPUS dan pengguna terlempar
  // kembali ke /login. Karena itu error dibedakan dari "baris tidak ada",
  // dan ada percobaan kedua tanpa kolom `role`.
  const withRole = await supabaseAdmin
    .from('sessions')
    .select('admin_id, last_seen_at, admins(username, role)')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (withRole.error) {
    // Kemungkinan besar kolom `role` belum ada — jangan hapus apa pun,
    // cukup baca tanpa peran.
    const fallback = await supabaseAdmin
      .from('sessions')
      .select('admin_id, admins(username)')
      .eq('token', token)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (fallback.error) {
      // Database benar-benar bermasalah. JANGAN hapus sesi — kalau dihapus,
      // gangguan sesaat pada DB akan memaksa semua admin login ulang.
      console.error('[apps] Gagal memvalidasi sesi (DB bermasalah):', fallback.error)
      return null
    }
    if (!fallback.data) {
      await supabaseAdmin.from('sessions').delete().eq('token', token)
      return null
    }
    return {
      id: fallback.data.admin_id,
      username:
        (fallback.data as { admins?: { username?: string } | null }).admins?.username ?? 'admin',
      // Tanpa kolom `role`, anggap 'admin' supaya portal tetap bisa dipakai
      // seperti sebelumnya (bukan 'viewer', yang akan mengunci semua tombol
      // tanpa penjelasan).
      role: 'admin',
    }
  }

  if (!withRole.data) {
    // Query sukses tapi tidak ada barisnya → token memang tidak dikenal atau
    // kedaluwarsa. Baru di sini pembersihan wajar dilakukan.
    await supabaseAdmin.from('sessions').delete().eq('token', token)
    return null
  }

  const joined = (withRole.data as {
    admins?: { username?: string; role?: string } | null
  }).admins

  // Catat kapan sesi terakhir dipakai (throttled 1 menit — lihat di atas).
  await touchLastSeen(
    token,
    (withRole.data as { last_seen_at?: string | null }).last_seen_at
  )

  return {
    id: withRole.data.admin_id,
    username: joined?.username ?? 'admin',
    role: sanitizeRoleValue(joined?.role),
  }
}

/** Salinan kecil dari roles.ts untuk menghindari impor melingkar. */
function sanitizeRoleValue(value: unknown): Role {
  const s = String(value ?? '')
  return s === 'superadmin' || s === 'admin' || s === 'viewer' ? s : 'admin'
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
export type ActivityEntity =
  | 'app'
  | 'category'
  | 'technology'
  | 'system'
  | 'changelog'

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
    if (query.search) {
      filtered = filtered.ilike('entity_name', `%${escapeIlike(query.search)}%`)
    }

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
