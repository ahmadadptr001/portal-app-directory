import type { AppEnv, AppStatus, ChangelogKind } from '@/types'

// Batas panjang SELARAS dengan kolom DB (schema.supabase.sql ↔ schema.mysql.sql).
// Nilai yang melebihi batas kolom akan ditolak di sini dengan pesan jelas,
// bukan error 500 "value too long" dari database.
export const LIMITS = {
  username: 50, // admins.username VARCHAR(50)
  passwordMin: 6,
  passwordMax: 72, // batas byte bcrypt — lebih panjang terpotong diam-diam
  appName: 200, // apps.name VARCHAR(200)
  category: 100, // categories.name VARCHAR(100)
  owner: 100, // apps.owner VARCHAR(100)
  version: 50, // apps.version VARCHAR(50)
  server: 100, // apps.server VARCHAR(100)
  database: 100, // apps.database VARCHAR(100)
  description: 5000, // apps.description TEXT (batas kewajaran)
  url: 2000, // apps.url TEXT
  tech: 50, // app_tech.tech VARCHAR(50)
  maxTech: 30,
  logEntity: 200, // activity_logs.entity_name VARCHAR(200)
  logDetail: 1000, // activity_logs.details TEXT (batas kewajaran)
  // --- Field katalog publik (migrasi 07) ---
  slug: 220, // apps.slug VARCHAR(220)
  logoUrl: 2000, // apps.logo_url TEXT
  contactName: 100, // apps.contact_name VARCHAR(100)
  contactEmail: 150, // apps.contact_email VARCHAR(150)
  contactPhone: 30, // apps.contact_phone VARCHAR(30)
  caption: 200, // app_screenshots.caption VARCHAR(200)
  maxScreenshots: 12,
  changelogNotes: 2000, // app_changelogs.notes TEXT (batas kewajaran)
} as const

export const VALID_STATUS = ['active', 'inactive', 'maintenance', 'deprecated'] as const
export const VALID_ENV = ['production', 'staging', 'development'] as const

export type Result<T> = { ok: true; value: T } | { ok: false; error: string }

const isString = (v: unknown): v is string => typeof v === 'string'

function cleanString(raw: unknown, max: number): string {
  return isString(raw) ? raw.trim().slice(0, max) : ''
}

function isHttpUrl(raw: string): boolean {
  if (!/^https?:\/\//i.test(raw)) return false
  try {
    new URL(raw)
    return true
  } catch {
    return false
  }
}

// --- Login ---
export function validateLoginInput(raw: unknown): Result<{ username: string; password: string }> {
  const body = (raw ?? {}) as Record<string, unknown>
  const username = isString(body.username) ? body.username.trim() : ''
  const password = isString(body.password) ? body.password : ''

  if (!username) return { ok: false, error: 'Username wajib diisi' }
  if (username.length > LIMITS.username) {
    return { ok: false, error: `Username maksimal ${LIMITS.username} karakter` }
  }
  if (!password) return { ok: false, error: 'Password wajib diisi' }
  if (password.length > 200) return { ok: false, error: 'Password terlalu panjang' }

  return { ok: true, value: { username, password } }
}

// --- Profil: ubah username ---
export function validateUsername(raw: unknown): Result<string> {
  const username = cleanString(raw, LIMITS.username)
  if (!username) return { ok: false, error: 'Username wajib diisi' }
  if (username.length > LIMITS.username) {
    return { ok: false, error: `Username maksimal ${LIMITS.username} karakter` }
  }
  return { ok: true, value: username }
}

// --- Profil: ubah password ---
export function validatePasswordChange(
  raw: unknown
): Result<{ currentPassword: string; newPassword: string }> {
  const body = (raw ?? {}) as Record<string, unknown>
  const currentPassword = isString(body.currentPassword) ? body.currentPassword : ''
  const newPassword = isString(body.newPassword) ? body.newPassword : ''

  if (!currentPassword) return { ok: false, error: 'Password saat ini wajib diisi' }
  if (currentPassword.length > 200) return { ok: false, error: 'Password saat ini terlalu panjang' }
  if (!newPassword) return { ok: false, error: 'Password baru wajib diisi' }
  if (newPassword.length < LIMITS.passwordMin) {
    return { ok: false, error: `Password baru minimal ${LIMITS.passwordMin} karakter` }
  }
  if (newPassword.length > LIMITS.passwordMax) {
    return {
      ok: false,
      error: `Password baru maksimal ${LIMITS.passwordMax} karakter (batas bcrypt)`,
    }
  }

  return { ok: true, value: { currentPassword, newPassword } }
}

// --- Aplikasi (tambah / ubah / impor) ---
export interface AppInput {
  name: string
  category: string
  status: AppStatus
  env: AppEnv
  url: string
  owner: string
  version: string
  progress: number
  description: string
  tech: string[]
  server: string
  database: string
  // Field katalog publik — opsional, lihat catatan di validateAppInput.
  slug?: string
  isPublic?: boolean
  logoUrl?: string | null
  goLiveDate?: string | null
  contactName?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  screenshots?: { url: string; caption: string | null }[]
}

export function validateAppInput(raw: unknown): Result<AppInput> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'Body tidak valid' }
  }
  const body = raw as Record<string, unknown>

  const name = cleanString(body.name, LIMITS.appName)
  if (!name) return { ok: false, error: 'Nama aplikasi wajib diisi' }

  const status = String(body.status ?? '')
  if (!VALID_STATUS.includes(status as AppStatus)) {
    return { ok: false, error: `Status tidak dikenal: ${status || '(kosong)'}` }
  }

  const env = String(body.env ?? '')
  if (!VALID_ENV.includes(env as AppEnv)) {
    return { ok: false, error: `Lingkungan tidak dikenal: ${env || '(kosong)'}` }
  }

  const category = cleanString(body.category, LIMITS.category)
  const url = cleanString(body.url, LIMITS.url)
  if (url && url !== '#' && !isHttpUrl(url)) {
    return { ok: false, error: 'URL harus diawali http:// atau https://' }
  }

  // Progress boleh angka atau string angka (klien mengirim number).
  let progress: number
  if (typeof body.progress === 'number') {
    progress = body.progress
  } else if (isString(body.progress) && body.progress.trim() !== '') {
    progress = Number(body.progress)
  } else {
    progress = Number.NaN
  }
  if (Number.isNaN(progress)) {
    return { ok: false, error: 'Progress harus berupa angka' }
  }
  if (progress < 0 || progress > 100) {
    return { ok: false, error: 'Progress harus antara 0 dan 100' }
  }

  let tech: string[] = []
  if (body.tech !== undefined) {
    if (!Array.isArray(body.tech)) {
      return { ok: false, error: 'Tech stack harus berupa daftar' }
    }
    tech = body.tech
      .map((t) => String(t).trim().slice(0, LIMITS.tech))
      .filter(Boolean)
    if (tech.length > LIMITS.maxTech) {
      return { ok: false, error: `Tech stack maksimal ${LIMITS.maxTech} item` }
    }
  }

  // --- Field katalog publik (migrasi 07) ---
  // SEMUANYA OPSIONAL. Validator ini juga dipakai jalur impor
  // (/api/admin/data), dan berkas backup yang dibuat sebelum migrasi 07
  // tidak punya field ini — mewajibkannya akan membuat seluruh backup
  // lama gagal diimpor.

  const logoUrl = cleanString(body.logoUrl, LIMITS.logoUrl)
  if (logoUrl && !isHttpUrl(logoUrl)) {
    return { ok: false, error: 'URL logo harus diawali http:// atau https://' }
  }

  const contactEmail = cleanString(body.contactEmail, LIMITS.contactEmail)
  // Pemeriksaan bentuk seadanya: ada satu '@', ada titik di domain, tanpa
  // spasi. Validasi email yang "sempurna" lewat regex adalah jebakan —
  // yang penting salah ketik jelas tertangkap.
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return { ok: false, error: 'Format email kontak tidak valid' }
  }

  const goLiveDate = cleanString(body.goLiveDate, 10)
  if (goLiveDate && !/^\d{4}-\d{2}-\d{2}$/.test(goLiveDate)) {
    return { ok: false, error: 'Tanggal go-live harus berformat YYYY-MM-DD' }
  }

  const screenshots: { url: string; caption: string | null }[] = []
  if (body.screenshots !== undefined) {
    if (!Array.isArray(body.screenshots)) {
      return { ok: false, error: 'Screenshot harus berupa daftar' }
    }
    if (body.screenshots.length > LIMITS.maxScreenshots) {
      return {
        ok: false,
        error: `Screenshot maksimal ${LIMITS.maxScreenshots} gambar`,
      }
    }
    for (const raw of body.screenshots) {
      const item = (raw ?? {}) as Record<string, unknown>
      const shotUrl = cleanString(item.url, LIMITS.url)
      if (!shotUrl) continue // baris kosong di form — abaikan diam-diam
      if (!isHttpUrl(shotUrl)) {
        return { ok: false, error: 'URL screenshot harus diawali http:// atau https://' }
      }
      screenshots.push({
        url: shotUrl,
        caption: cleanString(item.caption, LIMITS.caption) || null,
      })
    }
  }

  return {
    ok: true,
    value: {
      name,
      category: category || 'Uncategorized',
      status: status as AppStatus,
      env: env as AppEnv,
      url: url || '#',
      owner: cleanString(body.owner, LIMITS.owner) || '-',
      version: cleanString(body.version, LIMITS.version) || '1.0.0',
      progress,
      description: cleanString(body.description, LIMITS.description),
      tech,
      server: cleanString(body.server, LIMITS.server) || '-',
      database: cleanString(body.database, LIMITS.database) || '-',
      slug: cleanString(body.slug, LIMITS.slug) || undefined,
      isPublic: Boolean(body.isPublic),
      logoUrl: logoUrl || null,
      goLiveDate: goLiveDate || null,
      contactName: cleanString(body.contactName, LIMITS.contactName) || null,
      contactEmail: contactEmail || null,
      contactPhone: cleanString(body.contactPhone, LIMITS.contactPhone) || null,
      screenshots,
    },
  }
}

// --- Changelog aplikasi (tabel app_changelogs, migrasi 08) ---
const VALID_CHANGELOG_KINDS = ['feature', 'fix', 'security', 'other'] as const

/** Hasil validasi entri changelog (appId boleh kosong saat memperbarui). */
export interface ChangelogDraft {
  appId: number | undefined
  version: string
  releasedAt: string | null
  kind: ChangelogKind
  notes: string | null
  isPublic: boolean
}

export function validateChangelogInput(raw: unknown): Result<ChangelogDraft> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'Body tidak valid' }
  }
  const body = raw as Record<string, unknown>

  // appId wajib saat membuat; boleh tidak ada saat memperbarui.
  let appId: number | undefined
  if (body.appId !== undefined && body.appId !== null && body.appId !== '') {
    appId = Number(body.appId)
    if (!Number.isInteger(appId) || (appId as number) <= 0) {
      return { ok: false, error: 'Aplikasi tidak valid' }
    }
  }

  const version = cleanString(body.version, LIMITS.version)
  if (!version) return { ok: false, error: 'Versi wajib diisi' }

  const releasedAt = cleanString(body.releasedAt, 10)
  if (releasedAt && !/^\d{4}-\d{2}-\d{2}$/.test(releasedAt)) {
    return { ok: false, error: 'Tanggal rilis harus berformat YYYY-MM-DD' }
  }

  const kindRaw = String(body.kind ?? 'other')
  if (!(VALID_CHANGELOG_KINDS as readonly string[]).includes(kindRaw)) {
    return { ok: false, error: `Jenis perubahan tidak dikenal: ${kindRaw || '(kosong)'}` }
  }

  const notes = cleanString(body.notes, LIMITS.changelogNotes)

  return {
    ok: true,
    value: {
      // isPublic default TRUE — catatan versi pada dasarnya layak dipublikasi;
      // menandai internal adalah tindakan sadar dari admin.
      isPublic: body.isPublic === undefined ? true : Boolean(body.isPublic),
      appId,
      version,
      releasedAt: releasedAt || null,
      kind: kindRaw as ChangelogKind,
      notes: notes || null,
    },
  }
}

// --- Kategori ---
export function validateCategoryName(raw: unknown): Result<string> {
  const name = cleanString(raw, LIMITS.category)
  if (!name) return { ok: false, error: 'Nama kategori wajib diisi' }
  return { ok: true, value: name }
}

/**
 * Escape karakter khusus pola ILIKE (`%`, `_`, `\`) sebelum disisipkan ke
 * filter pencarian log. Tanpa ini, pengguna yang mengetik "100%" mencari
 * "100 diikuti apa pun" — hasil pencarian jadi salah tanpa pesan error.
 */
export function escapeIlike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&')
}

// --- Teknologi ---
export function validateTechnologyName(raw: unknown): Result<string> {
  const name = cleanString(raw, LIMITS.tech)
  if (!name) return { ok: false, error: 'Nama teknologi wajib diisi' }
  return { ok: true, value: name }
}
