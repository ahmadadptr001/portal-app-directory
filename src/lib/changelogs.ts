/**
 * Riwayat versi aplikasi (tabel `app_changelogs`, migrasi 08).
 *
 * Pola sama dengan lib lain: `supabaseAdmin` langsung, fungsi baca yang gagal
 * mengembalikan nilai kosong alih-alih melempar, dan pesan galat berbahasa
 * Indonesia.
 *
 * DUA JALUR BACA:
 *   - `listChangelogs`        → admin (semua entri, termasuk is_public=false)
 *   - `getPublicChangelogs`   → halaman publik (hanya is_public=true), dibungkus
 *     cache katalog (`KATALOG_TAG`) sehingga ikut ter-flush `revalidateKatalog()`
 *     di setiap mutasi admin.
 */
import { unstable_cache } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase'
import { isSupabaseConfigured } from '@/lib/apps'
import { KATALOG_TAG } from '@/lib/public'
import type { AppChangelog, ChangelogKind } from '@/types'

interface DbChangelogRow {
  id: number
  app_id: number
  version: string
  released_at: string | null
  kind: string
  notes: string | null
  is_public: boolean
  created_at?: string | null
}

function mapRow(r: DbChangelogRow): AppChangelog {
  const kind = (
    ['feature', 'fix', 'security', 'other'] as readonly string[]
  ).includes(r.kind)
    ? (r.kind as ChangelogKind)
    : 'other'
  return {
    id: r.id,
    appId: r.app_id,
    version: r.version,
    releasedAt: r.released_at,
    kind,
    notes: r.notes,
    isPublic: Boolean(r.is_public),
    createdAt: r.created_at ?? null,
  }
}

function selectChangelogs(appId: number) {
  return supabaseAdmin
    .from('app_changelogs')
    .select('*')
    .eq('app_id', appId)
    // Versi tanpa tanggal rilis paling bawah; sisanya terbaru dulu.
    .order('released_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
}

/** Semua entri changelog satu aplikasi — untuk halaman admin. */
export async function listChangelogs(appId: number): Promise<AppChangelog[]> {
  if (!Number.isInteger(appId) || !isSupabaseConfigured()) return []
  try {
    const { data, error } = await selectChangelogs(appId)
    if (error) throw error
    return (data ?? []).map(mapRow)
  } catch (e) {
    console.error('[changelogs] Gagal membaca changelog:', e)
    return []
  }
}

async function loadPublicChangelogs(appId: number): Promise<AppChangelog[]> {
  if (!Number.isInteger(appId) || !isSupabaseConfigured()) return []
  try {
    const { data, error } = await selectChangelogs(appId).eq('is_public', true)
    if (error) throw error
    return (data ?? []).map(mapRow)
  } catch (e) {
    console.error('[changelogs] Gagal membaca changelog publik:', e)
    return []
  }
}

/**
 * Entri publik satu aplikasi — dipakai halaman `/katalog/[slug]`.
 *
 * Cache-nya memakai tag katalog yang sama dengan data aplikasi, jadi satu
 * panggilan `revalidateKatalog()` dari route mutasi mana pun mengosongkan
 * keduanya sekaligus.
 */
export function getPublicChangelogs(appId: number): Promise<AppChangelog[]> {
  return unstable_cache(
    () => loadPublicChangelogs(appId),
    [`katalog-changelogs-${appId}`],
    { tags: [KATALOG_TAG], revalidate: 300 }
  )()
}

// ---------------------------------------------------------------------------
// Mutasi (dipanggil route API yang sudah menegakkan requireRole('admin'))
// ---------------------------------------------------------------------------

export interface ChangelogInput {
  appId?: number
  version: string
  releasedAt: string | null
  kind: ChangelogKind
  notes: string | null
  isPublic: boolean
}

export async function createChangelog(input: ChangelogInput): Promise<AppChangelog> {
  if (!input.appId || !Number.isInteger(input.appId)) {
    throw new Error('APP_ID_REQUIRED')
  }

  // Pesan lebih ramah daripada FK-violation mentah bila app-nya tidak ada.
  const { data: app } = await supabaseAdmin
    .from('apps')
    .select('id')
    .eq('id', input.appId)
    .maybeSingle()
  if (!app) throw new Error('APP_NOT_FOUND')

  const { data, error } = await supabaseAdmin
    .from('app_changelogs')
    .insert({
      app_id: input.appId,
      version: input.version,
      released_at: input.releasedAt,
      kind: input.kind,
      notes: input.notes,
      is_public: input.isPublic,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data as DbChangelogRow)
}

/** Perbarui entri; `appId` TIDAK ikut diubah (entri tidak boleh pindah aplikasi). */
export async function updateChangelog(
  id: number,
  input: ChangelogInput
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('app_changelogs')
    .update({
      version: input.version,
      released_at: input.releasedAt,
      kind: input.kind,
      notes: input.notes,
      is_public: input.isPublic,
    })
    .eq('id', id)
  if (error) throw error
}

export async function deleteChangelog(id: number): Promise<void> {
  const { error } = await supabaseAdmin.from('app_changelogs').delete().eq('id', id)
  if (error) throw error
}

/** Nama aplikasi pemilik entri — untuk pesan log aktivitas yang manusiawi. */
export async function getAppNameForLog(appId: number): Promise<string> {
  const { data } = await supabaseAdmin
    .from('apps')
    .select('name')
    .eq('id', appId)
    .maybeSingle()
  return data?.name ?? `aplikasi #${appId}`
}
