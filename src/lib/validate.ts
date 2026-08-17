import type { AppEnv, AppStatus } from '@/types'

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
    },
  }
}

// --- Kategori ---
export function validateCategoryName(raw: unknown): Result<string> {
  const name = cleanString(raw, LIMITS.category)
  if (!name) return { ok: false, error: 'Nama kategori wajib diisi' }
  return { ok: true, value: name }
}

// --- Teknologi ---
export function validateTechnologyName(raw: unknown): Result<string> {
  const name = cleanString(raw, LIMITS.tech)
  if (!name) return { ok: false, error: 'Nama teknologi wajib diisi' }
  return { ok: true, value: name }
}
